/**
 * Vercel serverless entry — do not call app.listen() here.
 * All /api/* requests are rewritten to this function.
 */
import app from "../backend/src/app.js";

export default app;
