import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    title: { type: String, required: true, trim: true },
    courseCode: { type: String, trim: true, default: "" },
    qrToken: { type: String, required: true },
    qrExpiresAt: { type: Date, required: true },
    createdAtQr: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sessionSchema.index({ facultyId: 1, createdAt: -1 });

export const Session = mongoose.model("Session", sessionSchema, "sessions");
