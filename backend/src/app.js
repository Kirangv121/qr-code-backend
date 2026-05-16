import express from "express";
import cors from "cors";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";

const app = express();

function allowedOrigins() {
  const raw = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const corsOptions = {
  origin(origin, callback) {
    const allowed = allowedOrigins();
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalized = origin.replace(/\/+$/, "");
    if (allowed.includes(normalized)) {
      callback(null, true);
      return;
    }
    console.warn("[CORS] blocked origin:", origin, "allowed:", allowed);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

/** Skip DB on preflight and health checks. */
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/health" || req.path === "/api/health") {
    return next();
  }
  try {
    await connectDb();
    next();
  } catch (err) {
    console.error("[DB]", err.message);
    res.status(503).json({ message: "Database unavailable" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use("/auth", authRoutes);
app.use("/sessions", sessionRoutes);
app.use("/attendance", attendanceRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

export default app;
