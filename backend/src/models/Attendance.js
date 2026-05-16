import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    markedAt: { type: Date, default: Date.now },
    formFullName: { type: String, trim: true, default: "" },
    formUsn: { type: String, trim: true, default: "" },
    formSem: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ sessionId: 1 });
attendanceSchema.index({ sessionId: 1, formUsn: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema, "attendance");
