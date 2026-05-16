import { Router } from "express";
import { authenticate, requireRoles } from "../middleware/auth.js";
import {
  createSession,
  listMySessions,
  getSession,
  closeSession,
} from "../controllers/sessionController.js";
import { sessionReport } from "../controllers/attendanceController.js";

const router = Router();

router.use(authenticate, requireRoles("faculty"));

router.post("/", createSession);
router.get("/mine", listMySessions);
router.get("/:id/report", sessionReport);
router.get("/:id", getSession);
router.post("/:id/close", closeSession);

export default router;
