import bcrypt from "bcryptjs";
import { Faculty } from "../models/Faculty.js";
import { Student } from "../models/Student.js";
import { signToken } from "../utils/jwt.js";

const BCRYPT_ROUNDS = 10;
const MAX_PROFILE_PHOTO_CHARS = 450_000;

function normalizeUsn(usn) {
  return String(usn || "")
    .trim()
    .toUpperCase();
}

function publicStudent(account) {
  if (!account) return null;
  return {
    id: account._id,
    name: account.name,
    email: account.email,
    role: "student",
    studentId: account.usn,
    department: account.department || "",
    semester: account.semester || "",
    profilePhotoDataUrl: account.profilePhotoDataUrl || "",
  };
}

function publicFaculty(account) {
  if (!account) return null;
  return {
    id: account._id,
    name: account.name,
    email: account.email,
    role: "faculty",
    studentId: "",
    department: account.department || "",
    profilePhotoDataUrl: account.profilePhotoDataUrl || "",
  };
}

function validatePhotoDataUrl(value) {
  if (value === null || value === "") return { ok: true, cleared: true };
  const s = String(value);
  if (s.length > MAX_PROFILE_PHOTO_CHARS) {
    return { ok: false, message: "Photo is too large. Try an image under about 300 KB." };
  }
  if (!s.startsWith("data:image/")) {
    return { ok: false, message: "Photo must be an image (PNG or JPEG)." };
  }
  return { ok: true, value: s };
}

export async function register(req, res) {
  try {
    const { name, email, password, role, studentId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, and role are required" });
    }
    if (!["faculty", "student"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const emailLower = email.toLowerCase();
    const [facultyEmail, studentEmail] = await Promise.all([
      Faculty.findOne({ email: emailLower }).select("_id").lean(),
      Student.findOne({ email: emailLower }).select("_id").lean(),
    ]);
    if (facultyEmail || studentEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    if (role === "faculty") {
      const doc = await Faculty.create({
        name,
        email: emailLower,
        passwordHash,
      });
      console.log(`[MongoDB] faculty registered id=${doc._id} email=${doc.email}`);
      return res.status(201).json({
        message: "Account created",
        user: publicFaculty(doc.toObject ? doc.toObject() : doc),
      });
    }

    const usn = normalizeUsn(studentId);
    if (!usn) {
      return res.status(400).json({ message: "USN is required for student accounts" });
    }
    const usnTaken = await Student.findOne({ usn }).select("_id").lean();
    if (usnTaken) {
      return res.status(409).json({ message: "This USN is already registered" });
    }

    const doc = await Student.create({
      name,
      email: emailLower,
      passwordHash,
      usn,
    });
    console.log(`[MongoDB] student registered id=${doc._id} email=${doc.email} usn=${doc.usn}`);
    return res.status(201).json({
      message: "Account created",
      user: publicStudent(doc.toObject ? doc.toObject() : doc),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "email, password, and role are required" });
    }
    if (!["faculty", "student"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const emailLower = email.toLowerCase();
    let account = null;
    if (role === "faculty") {
      account = await Faculty.findOne({ email: emailLower });
    } else {
      account = await Student.findOne({ email: emailLower });
    }

    if (!account || !account.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({ sub: account._id.toString(), role });
    console.log(`[Auth] login ok id=${account._id} role=${role}`);
    const user =
      role === "student"
        ? publicStudent(account.toObject ? account.toObject() : account)
        : publicFaculty(account.toObject ? account.toObject() : account);
    return res.json({ token, user });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

export async function me(req, res) {
  const u = req.user;
  if (u.role === "student") {
    return res.json({ user: publicStudent(u) });
  }
  return res.json({ user: publicFaculty(u) });
}

export async function patchStudentProfile(req, res) {
  try {
    const { name, department, semester, profilePhotoDataUrl } = req.body;
    const updates = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty" });
      updates.name = n;
    }
    if (department !== undefined) updates.department = String(department).trim();
    if (semester !== undefined) updates.semester = String(semester).trim();
    if (profilePhotoDataUrl !== undefined) {
      const v = validatePhotoDataUrl(profilePhotoDataUrl);
      if (!v.ok) return res.status(400).json({ message: v.message });
      updates.profilePhotoDataUrl = v.cleared ? "" : v.value;
    }
    const doc = await Student.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
      .select("-passwordHash")
      .lean();
    return res.json({ user: publicStudent(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

export async function patchFacultyProfile(req, res) {
  try {
    const { name, department, profilePhotoDataUrl } = req.body;
    const updates = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty" });
      updates.name = n;
    }
    if (department !== undefined) updates.department = String(department).trim();
    if (profilePhotoDataUrl !== undefined) {
      const v = validatePhotoDataUrl(profilePhotoDataUrl);
      if (!v.ok) return res.status(400).json({ message: v.message });
      updates.profilePhotoDataUrl = v.cleared ? "" : v.value;
    }
    const doc = await Faculty.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
      .select("-passwordHash")
      .lean();
    return res.json({ user: publicFaculty(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
