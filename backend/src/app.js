import express from "express";
import cors from "cors";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";

const app = express();

function corsOrigins() {
  const raw = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

/** Ensure MongoDB is connected (cached for serverless). */
app.use(async (_req, res, next) => {
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
