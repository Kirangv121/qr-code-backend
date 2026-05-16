import { verifyToken } from "../utils/jwt.js";
import { Faculty } from "../models/Faculty.js";
import { Student } from "../models/Student.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const decoded = verifyToken(token);
    const role = decoded.role;
    let account = null;
    if (role === "faculty") {
      account = await Faculty.findById(decoded.sub).select("-passwordHash").lean();
    } else if (role === "student") {
      account = await Student.findById(decoded.sub).select("-passwordHash").lean();
    }
    if (!account || !account.isActive) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }
    req.user = { ...account, role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
