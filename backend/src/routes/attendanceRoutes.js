import { Router } from "express";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { scanQr, submitAttendanceForm, myAttendance, markAttendanceFromQr } from "../controllers/attendanceController.js";

const router = Router();

router.use(authenticate);

router.post("/scan-qr", requireRoles("student"), scanQr);
router.post("/mark-scan", requireRoles("student"), markAttendanceFromQr);
router.post("/submit-form", requireRoles("student"), submitAttendanceForm);
router.get("/mine", requireRoles("student"), myAttendance);

export default router;
