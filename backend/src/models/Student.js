import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** University Seat Number — unique per student, required at signup */
    usn: { type: String, required: true, trim: true, uppercase: true },
    department: { type: String, trim: true, default: "" },
    semester: { type: String, trim: true, default: "" },
    /** data URL (e.g. image/jpeg;base64,...) — keep uploads small */
    profilePhotoDataUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

studentSchema.index({ usn: 1 }, { unique: true });

export const Student = mongoose.model("Student", studentSchema, "students");
