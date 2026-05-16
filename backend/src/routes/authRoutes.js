import { Router } from "express";
import {
  login,
  me,
  register,
  patchStudentProfile,
  patchFacultyProfile,
} from "../controllers/authController.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, me);
router.patch("/profile/student", authenticate, requireRoles("student"), patchStudentProfile);
router.patch("/profile/faculty", authenticate, requireRoles("faculty"), patchFacultyProfile);

export default router;
