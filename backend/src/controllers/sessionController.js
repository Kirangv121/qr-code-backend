// import axios from "axios";
// import http from "http";
// import { Attendance } from "../models/Attendance.js";
// import { Session } from "../models/Session.js";
// import { randomToken } from "../utils/tokens.js";

// const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });

// function qrExpiryMs() {
//   const mins = Number(process.env.QR_EXPIRY_MINUTES || 5);
//   return mins * 60 * 1000;
// }

// async function requestQrImage(payload) {
//   const base = process.env.PYTHON_QR_SERVICE_URL || "http://127.0.0.1:5001";
//   const { data } = await axios.post(`${base}/generate-qr`, payload, {
//     timeout: 8000,
//     headers: { "Content-Type": "application/json" },
//     httpAgent,
//   });
//   if (!data?.image_base64) {
//     throw new Error("QR service returned invalid payload");
//   }
//   return data.image_base64;
// }

// export async function createSession(req, res) {
//   try {
//     const { title, courseCode } = req.body;
//     if (!title) {
//       return res.status(400).json({ message: "title is required" });
//     }
//     const now = new Date();
//     const expires = new Date(now.getTime() + qrExpiryMs());
//     const qrToken = randomToken(24);
//     const session = await Session.create({
//       facultyId: req.user._id,
//       title,
//       courseCode: courseCode || "",
//       qrToken,
//       qrExpiresAt: expires,
//       createdAtQr: now,
//     });

//     const qrPayload = {
//       sessionId: session._id.toString(),
//       timestamp: now.toISOString(),
//       token: qrToken,
//     };

//     let imageBase64;
//     try {
//       imageBase64 = await requestQrImage(qrPayload);
//     } catch (e) {
//       await Session.deleteOne({ _id: session._id });
//       console.error("[QR] generation failed:", e.message);
//       return res.status(502).json({
//         message: "QR generation service unavailable — is python app.py running on port 5001?",
//         detail: e.message,
//       });
//     }

//     console.log(`[MongoDB] session created id=${session._id} faculty=${req.user._id} title="${session.title}"`);

//     return res.status(201).json({
//       session: {
//         id: session._id,
//         title: session.title,
//         courseCode: session.courseCode,
//         qrExpiresAt: session.qrExpiresAt,
//         createdAt: session.createdAt,
//       },
//       qrPayload,
//       qrImageBase64: imageBase64,
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// export async function listMySessions(req, res) {
//   try {
//     const sessions = await Session.find({ facultyId: req.user._id }).sort({ createdAt: -1 }).lean();
//     const ids = sessions.map((s) => s._id);
//     let countMap = {};
//     if (ids.length) {
//       const countsAgg = await Attendance.aggregate([
//         { $match: { sessionId: { $in: ids } } },
//         { $group: { _id: "$sessionId", count: { $sum: 1 } } },
//       ]);
//       countMap = Object.fromEntries(countsAgg.map((row) => [row._id.toString(), row.count]));
//     }
//     const now = new Date();
//     return res.json({
//       sessions: sessions.map((s) => {
//         let qrStatus = "Active";
//         if (s.isClosed) qrStatus = "Closed";
//         else if (now > new Date(s.qrExpiresAt)) qrStatus = "Expired";
//         return {
//           id: s._id,
//           title: s.title,
//           courseCode: s.courseCode,
//           qrExpiresAt: s.qrExpiresAt,
//           isClosed: s.isClosed,
//           createdAt: s.createdAt,
//           attendanceCount: countMap[s._id.toString()] || 0,
//           qrStatus,
//         };
//       }),
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// export async function getSession(req, res) {
//   try {
//     const session = await Session.findById(req.params.id);
//     if (!session) {
//       return res.status(404).json({ message: "Session not found" });
//     }
//     if (session.facultyId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: "Forbidden" });
//     }

//     const now = new Date();
//     const expired = now > session.qrExpiresAt;
//     const qrPayload = {
//       sessionId: session._id.toString(),
//       timestamp: session.createdAtQr.toISOString(),
//       token: session.qrToken,
//     };

//     let qrImageBase64 = null;
//     if (!expired && !session.isClosed) {
//       try {
//         qrImageBase64 = await requestQrImage(qrPayload);
//       } catch (e) {
//         console.error("[QR] regenerate failed:", e.message);
//         qrImageBase64 = null;
//       }
//     }

//     return res.json({
//       session: {
//         id: session._id,
//         title: session.title,
//         courseCode: session.courseCode,
//         qrExpiresAt: session.qrExpiresAt,
//         isClosed: session.isClosed,
//         createdAt: session.createdAt,
//         facultyId: session.facultyId,
//       },
//       qrPayload,
//       qrImageBase64,
//       qrExpired: expired,
//     });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }

// export async function closeSession(req, res) {
//   try {
//     const session = await Session.findById(req.params.id);
//     if (!session) {
//       return res.status(404).json({ message: "Session not found" });
//     }
//     if (session.facultyId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: "Forbidden" });
//     }
//     session.isClosed = true;
//     await session.save();
//     return res.json({ message: "Session closed", session: { id: session._id, isClosed: true } });
//   } catch (err) {
//     return res.status(500).json({ message: err.message || "Server error" });
//   }
// }


import axios from "axios";
import http from "http";
import QRCode from "qrcode";
import { Attendance } from "../models/Attendance.js";
import { Session } from "../models/Session.js";
import { randomToken } from "../utils/tokens.js";

// Reusable HTTP agent for better connection pooling
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });

function qrExpiryMs() {
  const mins = Number(process.env.QR_EXPIRY_MINUTES || 5);
  return mins * 60 * 1000;
}

/** Raw PNG base64 only (no data: URL prefix). */
function normalizeQrBase64(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new Error("QR service returned invalid payload");
  }
  const trimmed = imageBase64.trim();
  const m = trimmed.match(/^data:image\/png;base64,(.+)$/i);
  return m ? m[1] : trimmed;
}

async function generateQrImageNode(payload) {
  const text = JSON.stringify({
    sessionId: String(payload.sessionId),
    timestamp: payload.timestamp,
    token: payload.token,
  });
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });
  return normalizeQrBase64(dataUrl);
}

/**
 * Prefer embedded Node QR (no Python). Optional Python fallback if Node fails.
 */
async function requestQrImage(payload) {
  try {
    return await generateQrImageNode(payload);
  } catch (nodeErr) {
    console.warn("[QR] Node generator failed:", nodeErr.message);
  }

  const base = (process.env.PYTHON_QR_SERVICE_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
  try {
    const { data } = await axios.post(`${base}/generate-qr`, payload, {
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
      httpAgent,
    });
    return normalizeQrBase64(data?.image_base64);
  } catch (error) {
    const msg = error.response ? `Python Service Error: ${error.response.status}` : error.message;
    throw new Error(msg);
  }
}

/** 
 * Creates a new session and generates the initial QR code.
 */
export async function createSession(req, res) {
  try {
    const { title, courseCode } = req.body;
    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + qrExpiryMs());
    const qrToken = randomToken(24);

    // Create the session in DB
    const session = await Session.create({
      facultyId: req.user._id,
      title: title.trim(),
      courseCode: (courseCode || "").trim().toUpperCase(),
      qrToken,
      qrExpiresAt: expires,
      createdAtQr: now,
    });

    const qrPayload = {
      sessionId: session._id.toString(),
      timestamp: now.toISOString(),
      token: qrToken,
    };

    try {
      const imageBase64 = await requestQrImage(qrPayload);
      
      console.log(`[Session] Created: ${session._id} by Faculty: ${req.user._id}`);
      
      return res.status(201).json({
        session: {
          id: session._id,
          title: session.title,
          courseCode: session.courseCode,
          qrExpiresAt: session.qrExpiresAt,
          createdAt: session.createdAt,
        },
        qrPayload,
        qrImageBase64: imageBase64,
      });
    } catch (e) {
      // ROLLBACK: If QR generation fails, delete the session so we don't have broken entries
      await Session.deleteOne({ _id: session._id });
      console.error("[QR Error] Rollback session deletion:", e.message);
      
      return res.status(502).json({
        message: "Could not generate QR image. Check server logs.",
        detail: e.message,
      });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

/** 
 * Lists all sessions for the logged-in faculty with attendance counts.
 */
export async function listMySessions(req, res) {
  try {
    // Find sessions and use .lean() for faster execution
    const sessions = await Session.find({ facultyId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const ids = sessions.map((s) => s._id);
    let countMap = {};

    if (ids.length) {
      const countsAgg = await Attendance.aggregate([
        { $match: { sessionId: { $in: ids } } },
        { $group: { _id: "$sessionId", count: { $sum: 1 } } },
      ]);
      countMap = Object.fromEntries(countsAgg.map((row) => [row._id.toString(), row.count]));
    }

    const now = new Date();
    return res.json({
      sessions: sessions.map((s) => {
        let qrStatus = "Active";
        if (s.isClosed) qrStatus = "Closed";
        else if (now > new Date(s.qrExpiresAt)) qrStatus = "Expired";

        return {
          id: s._id,
          title: s.title,
          courseCode: s.courseCode,
          qrExpiresAt: s.qrExpiresAt,
          isClosed: s.isClosed,
          createdAt: s.createdAt,
          attendanceCount: countMap[s._id.toString()] || 0,
          qrStatus,
        };
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

/** 
 * Retrieves a single session and attempts to regenerate the QR code if still active.
 */
export async function getSession(req, res) {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access Denied" });
    }

    const now = new Date();
    const isExpired = now > session.qrExpiresAt;
    
    const qrPayload = {
      sessionId: session._id.toString(),
      timestamp: session.createdAtQr.toISOString(),
      token: session.qrToken,
    };

    let qrImageBase64 = null;
    let qrError = null;

    // Only try to generate QR if the session is still valid
    if (!isExpired && !session.isClosed) {
      try {
        qrImageBase64 = await requestQrImage(qrPayload);
      } catch (e) {
        console.error("[QR] Regeneration failed:", e.message);
        qrError = "QR Generator service offline";
      }
    }

    return res.json({
      session: {
        id: session._id,
        title: session.title,
        courseCode: session.courseCode,
        qrExpiresAt: session.qrExpiresAt,
        isClosed: session.isClosed,
        createdAt: session.createdAt,
        facultyId: session.facultyId,
      },
      qrPayload,
      qrImageBase64,
      qrExpired: isExpired,
      qrError // Included to help frontend show a warning if Python is down
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

/** 
 * Manually closes a session.
 */
export async function closeSession(req, res) {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, facultyId: req.user._id },
      { isClosed: true },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: "Session not found or unauthorized" });
    }

    return res.json({ 
      message: "Attendance session closed successfully", 
      session: { id: session._id, isClosed: true } 
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}