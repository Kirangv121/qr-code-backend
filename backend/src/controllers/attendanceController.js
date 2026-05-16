// import mongoose from "mongoose";
// import { Session } from "../models/Session.js";
// import { Attendance } from "../models/Attendance.js";
// import { signScanTicket, verifyScanTicket } from "../utils/jwt.js";

// function normalizeUsn(usn) {
//   return String(usn || "")
//     .trim()
//     .toUpperCase();
// }

// function parseQrPayload(qrText) {
//   let parsed;
//   try {
//     parsed = JSON.parse(qrText);
//   } catch {
//     return { error: "Invalid QR payload" };
//   }
//   const { sessionId, token, timestamp } = parsed;
//   if (!sessionId || !token) {
//     return { error: "Invalid QR data" };
//   }
//   if (!mongoose.Types.ObjectId.isValid(sessionId)) {
//     return { error: "Invalid session" };
//   }
//   return { sessionId, token, timestamp };
// }

// async function loadValidSession(sessionId, token) {
//   const session = await Session.findById(sessionId);
//   if (!session || session.isClosed) {
//     return { error: "Session not found or closed", session: null };
//   }
//   if (session.qrToken !== token) {
//     return { error: "Invalid QR token", session: null };
//   }
//   const now = new Date();
//   if (now > session.qrExpiresAt) {
//     return { error: "QR code has expired", session: null };
//   }
//   return { session, error: null };
// }

// /** Step 1: validate QR from live camera scan; returns short-lived ticket for the form step. */
// export async function scanQr(req, res) {
//   try {
//     if (req.user.role !== "student") {
//       return res.status(403).json({ message: "Only students can scan attendance QR" });
//     }
//     const { qrText } = req.body;
//     if (!qrText || typeof qrText !== "string") {
//       return res.status(400).json({ message: "qrText is required" });
//     }

//     const parsed = parseQrPayload(qrText);
//     if (parsed.error) {
//       return res.status(400).json({ message: parsed.error });
//     }

//     const { session, error } = await loadValidSession(parsed.sessionId, parsed.token);
//     if (error) {
//       return res.status(400).json({ message: error });
//     }

//     if (parsed.timestamp) {
//       const ts = new Date(parsed.timestamp);
//       if (Number.isNaN(ts.getTime()) || ts.getTime() > session.qrExpiresAt.getTime()) {
//         return res.status(400).json({ message: "Invalid QR timestamp" });
//       }
//     }

//     const existing = await Attendance.findOne({ studentId: req.user._id, sessionId: session._id });
//     if (existing) {
//       return res.status(409).json({ message: "You have already submitted attendance for this session" });
//     }

//     const scanTicket = signScanTicket({
//       studentId: req.user._id.toString(),
//       sessionId: session._id.toString(),
//       qrToken: parsed.token,
//     });

//     console.log(
//       `[MongoDB] QR scan OK student=${req.user._id} session=${session._id} subject="${session.title}"`
//     );

//     return res.json({
//       scanTicket,
//       session: {
//         id: session._id,
//         title: session.title,
//         courseCode: session.courseCode,
//         qrExpiresAt: session.qrExpiresAt,
//       },
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// /** Step 2: submit attendance details; stored in MongoDB `attendance` collection. */
// export async function submitAttendanceForm(req, res) {
//   try {
//     if (req.user.role !== "student") {
//       return res.status(403).json({ message: "Only students can submit attendance" });
//     }

//     const { scanTicket, fullName, usn, sem } = req.body;
//     if (!scanTicket || !fullName || !usn || !sem) {
//       return res.status(400).json({ message: "scanTicket, fullName, usn, and sem are required" });
//     }

//     let ticket;
//     try {
//       ticket = verifyScanTicket(scanTicket);
//     } catch {
//       return res.status(400).json({ message: "Invalid or expired scan ticket. Scan the QR again." });
//     }

//     if (ticket.studentId !== req.user._id.toString()) {
//       return res.status(403).json({ message: "Scan ticket does not match your account" });
//     }

//     if (!req.user.usn) {
//       return res.status(400).json({ message: "Your profile has no USN on file. Contact faculty to fix your account." });
//     }

//     const accountUsn = normalizeUsn(req.user.usn);
//     const formUsn = normalizeUsn(usn);
//     if (formUsn !== accountUsn) {
//       return res.status(400).json({
//         message: "USN on the form must match your registered USN (prevents marking for someone else).",
//       });
//     }

//     const session = await Session.findById(ticket.sessionId);
//     if (!session || session.isClosed) {
//       return res.status(400).json({ message: "Session not found or closed" });
//     }
//     if (session.qrToken !== ticket.qrToken) {
//       return res.status(403).json({ message: "Invalid session token" });
//     }

//     const now = new Date();
//     if (now > session.qrExpiresAt) {
//       return res.status(400).json({ message: "QR window closed — submit before the code expires" });
//     }

//     try {
//       const record = await Attendance.create({
//         studentId: req.user._id,
//         sessionId: session._id,
//         facultyId: session.facultyId,
//         markedAt: now,
//         formFullName: String(fullName).trim(),
//         formUsn,
//         formSem: String(sem).trim(),
//       });
//       console.log(
//         `[MongoDB] attendance saved id=${record._id} session=${session._id} student=${req.user._id} usn=${formUsn}`
//       );
//       return res.status(201).json({
//         message: "Attendance submitted",
//         attendance: {
//           id: record._id,
//           sessionId: record.sessionId,
//           markedAt: record.markedAt,
//         },
//       });
//     } catch (err) {
//       if (err.code === 11000) {
//         return res.status(409).json({
//           message: "Duplicate: this USN or your account is already recorded for this session",
//         });
//       }
//       throw err;
//     }
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// export async function myAttendance(req, res) {
//   try {
//     if (req.user.role !== "student") {
//       return res.status(403).json({ message: "Forbidden" });
//     }
//     const rows = await Attendance.find({ studentId: req.user._id })
//       .populate("sessionId", "title courseCode createdAt")
//       .sort({ markedAt: -1 })
//       .lean();

//     return res.json({
//       records: rows.map((r) => ({
//         id: r._id,
//         markedAt: r.markedAt,
//         formFullName: r.formFullName,
//         formUsn: r.formUsn,
//         formSem: r.formSem,
//         session: r.sessionId
//           ? {
//               id: r.sessionId._id,
//               title: r.sessionId.title,
//               courseCode: r.sessionId.courseCode,
//               createdAt: r.sessionId.createdAt,
//             }
//           : null,
//       })),
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// export async function sessionReport(req, res) {
//   try {
//     const session = await Session.findById(req.params.id);
//     if (!session) {
//       return res.status(404).json({ message: "Session not found" });
//     }
//     if (session.facultyId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: "Forbidden" });
//     }

//     const list = await Attendance.find({ sessionId: session._id })
//       .populate("studentId", "name email usn department")
//       .sort({ markedAt: 1 })
//       .lean();

//     const total = list.length;
//     return res.json({
//       session: {
//         id: session._id,
//         title: session.title,
//         courseCode: session.courseCode,
//         createdAt: session.createdAt,
//         qrExpiresAt: session.qrExpiresAt,
//         isClosed: session.isClosed,
//       },
//       totalPresent: total,
//       students: list.map((a) => ({
//         attendanceId: a._id,
//         markedAt: a.markedAt,
//         formFullName: a.formFullName,
//         formUsn: a.formUsn,
//         formSem: a.formSem,
//         student: a.studentId
//           ? {
//               id: a.studentId._id,
//               name: a.studentId.name,
//               email: a.studentId.email,
//               usn: a.studentId.usn,
//               department: a.studentId.department,
//             }
//           : null,
//       })),
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }
 



import mongoose from "mongoose";
import { Session } from "../models/Session.js";
import { Attendance } from "../models/Attendance.js";
import { signScanTicket, verifyScanTicket } from "../utils/jwt.js";

// Helper for consistent USN formatting
function normalizeUsn(usn) {
  return String(usn || "").trim().toUpperCase();
}

/** Some cameras add prefix/suffix; extract first JSON object from scan text. */
function extractJsonFromScan(qrText) {
  const raw = String(qrText ?? "").trim();
  if (!raw) return { error: "Empty scan" };
  const tryParseObject = (s) => {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object" && !Array.isArray(o)) return s;
    } catch {
      /* ignore */
    }
    return null;
  };
  const direct = tryParseObject(raw);
  if (direct) return { jsonText: direct };
  const i = raw.indexOf("{");
  const j = raw.lastIndexOf("}");
  if (i === -1 || j <= i) return { error: "Invalid QR: could not read attendance data" };
  const slice = raw.slice(i, j + 1);
  const inner = tryParseObject(slice);
  if (inner) return { jsonText: inner };
  return { error: "Invalid QR format" };
}

function parseQrFields(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "Invalid QR format" };
  }
  const { sessionId, token, timestamp } = parsed;
  if (!sessionId || !token) return { error: "Incomplete QR data" };
  if (!mongoose.Types.ObjectId.isValid(sessionId)) return { error: "Invalid session ID" };
  return { sessionId, token, timestamp };
}

async function loadSessionForAttendanceQr(parsed) {
  const session = await Session.findById(parsed.sessionId);
  if (!session || session.isClosed) {
    return { error: "Session closed or not found", session: null };
  }
  if (session.qrToken !== parsed.token) {
    return { error: "Invalid QR token", session: null };
  }
  const now = new Date();
  if (now > session.qrExpiresAt) {
    return { error: "QR code has expired", session: null };
  }
  if (parsed.timestamp) {
    const ts = new Date(parsed.timestamp);
    if (Number.isNaN(ts.getTime()) || ts.getTime() > session.qrExpiresAt.getTime()) {
      return { error: "Invalid QR timestamp", session: null };
    }
  }
  return { session, error: null };
}

/** Step 1: Validate QR scan */
export async function scanQr(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can scan" });
    }
    const { qrText } = req.body;
    if (!qrText || typeof qrText !== "string") {
      return res.status(400).json({ message: "qrText is required" });
    }

    const extracted = extractJsonFromScan(qrText);
    if (extracted.error) return res.status(400).json({ message: extracted.error });

    const parsed = parseQrFields(extracted.jsonText);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const { session, error } = await loadSessionForAttendanceQr(parsed);
    if (error) return res.status(400).json({ message: error });

    const existing = await Attendance.findOne({ studentId: req.user._id, sessionId: session._id });
    if (existing) {
      return res.status(409).json({ message: "Attendance already marked" });
    }

    const scanTicket = signScanTicket({
      studentId: req.user._id.toString(),
      sessionId: session._id.toString(),
      qrToken: parsed.token,
    });

    return res.json({
      scanTicket,
      session: {
        id: session._id,
        title: session.title,
        courseCode: session.courseCode,
        qrExpiresAt: session.qrExpiresAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

/**
 * One-step: validate QR and record attendance using profile (no separate form).
 */
export async function markAttendanceFromQr(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can mark attendance" });
    }
    const { qrText } = req.body;
    if (!qrText || typeof qrText !== "string") {
      return res.status(400).json({ message: "qrText is required" });
    }

    const extracted = extractJsonFromScan(qrText);
    if (extracted.error) return res.status(400).json({ message: extracted.error });

    const parsed = parseQrFields(extracted.jsonText);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const { session, error } = await loadSessionForAttendanceQr(parsed);
    if (error) return res.status(400).json({ message: error });

    const existing = await Attendance.findOne({ studentId: req.user._id, sessionId: session._id });
    if (existing) {
      return res.status(200).json({
        message: "You already marked attendance for this session",
        alreadyMarked: true,
        session: { id: session._id, title: session.title, courseCode: session.courseCode },
      });
    }

    if (!req.user.usn) {
      return res.status(400).json({ message: "Your account has no USN on file" });
    }

    const formUsn = normalizeUsn(req.user.usn);
    const formFullName = String(req.user.name || "").trim() || "Student";
    const formSem = String(req.user.semester || "").trim() || "—";

    try {
      const record = await Attendance.create({
        studentId: req.user._id,
        sessionId: session._id,
        facultyId: session.facultyId,
        markedAt: new Date(),
        formFullName,
        formUsn,
        formSem,
      });
      return res.status(201).json({
        message: "Attendance marked",
        session: {
          id: session._id,
          title: session.title,
          courseCode: session.courseCode,
        },
        attendanceId: record._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({
          message: "You already marked attendance for this session",
          alreadyMarked: true,
          session: { id: session._id, title: session.title, courseCode: session.courseCode },
        });
      }
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

/** Step 2: Submit Form */
export async function submitAttendanceForm(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can submit attendance" });
    }

    const { scanTicket, fullName, usn, sem } = req.body;
    if (!scanTicket || !fullName || !usn || !sem) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let ticket;
    try {
      ticket = verifyScanTicket(scanTicket);
    } catch {
      return res.status(400).json({ message: "Scan ticket expired. Scan QR again." });
    }

    if (ticket.studentId !== req.user._id.toString()) {
      return res.status(403).json({ message: "This scan ticket does not match your account" });
    }

    if (!req.user.usn) {
      return res.status(400).json({ message: "Your profile has no USN on file. Contact faculty." });
    }

    const accountUsn = normalizeUsn(req.user.usn);
    const formUsn = normalizeUsn(usn);

    if (formUsn !== accountUsn) {
      return res.status(400).json({ message: "USN mismatch. Use your registered USN." });
    }

    const session = await Session.findById(ticket.sessionId);
    if (!session || session.isClosed) {
      return res.status(400).json({ message: "Session not found or closed" });
    }
    if (session.qrToken !== ticket.qrToken) {
      return res.status(403).json({ message: "Invalid session token" });
    }

    const now = new Date();
    if (now > session.qrExpiresAt) {
      return res.status(400).json({ message: "QR window closed. Ask faculty to show the code again." });
    }

    const already = await Attendance.findOne({ studentId: req.user._id, sessionId: session._id });
    if (already) {
      return res.status(409).json({ message: "You already marked attendance for this session" });
    }

    const record = await Attendance.create({
      studentId: req.user._id,
      sessionId: session._id,
      facultyId: session.facultyId,
      markedAt: now,
      formFullName: String(fullName).trim(),
      formUsn,
      formSem: String(sem).trim(),
    });

    return res.status(201).json({ message: "Attendance marked", id: record._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate entry" });
    return res.status(500).json({ message: err.message });
  }
}

/** Added back: Student's personal attendance history */
export async function myAttendance(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const rows = await Attendance.find({ studentId: req.user._id })
      .populate("sessionId", "title courseCode createdAt")
      .sort({ markedAt: -1 })
      .lean();

    return res.json({
      records: rows.map((r) => ({
        id: r._id,
        markedAt: r.markedAt,
        formFullName: r.formFullName,
        formUsn: r.formUsn,
        formSem: r.formSem,
        session: r.sessionId ? {
          id: r.sessionId._id,
          title: r.sessionId.title,
          courseCode: r.sessionId.courseCode,
          createdAt: r.sessionId.createdAt,
        } : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

/** Added back: Faculty's report for a specific session */
export async function sessionReport(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const list = await Attendance.find({ sessionId: session._id })
      .populate("studentId", "name email usn department")
      .sort({ markedAt: 1 })
      .lean();

    return res.json({
      session: {
        id: session._id,
        title: session.title,
        courseCode: session.courseCode,
        createdAt: session.createdAt,
        qrExpiresAt: session.qrExpiresAt,
        isClosed: session.isClosed,
      },
      totalPresent: list.length,
      students: list.map((a) => ({
        attendanceId: a._id,
        markedAt: a.markedAt,
        formFullName: a.formFullName,
        formUsn: a.formUsn,
        formSem: a.formSem,
        student: a.studentId,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}