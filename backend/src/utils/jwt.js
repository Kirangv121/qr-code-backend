import jwt from "jsonwebtoken";

export function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret);
}

/** Short-lived ticket after a valid QR scan (before form submit). */
export function signScanTicket(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const ttlSec = Number(process.env.SCAN_TICKET_TTL_SEC || 300);
  return jwt.sign({ typ: "scan", ...payload }, secret, { expiresIn: ttlSec });
}

export function verifyScanTicket(token) {
  const decoded = verifyToken(token);
  if (decoded.typ !== "scan") {
    const err = new Error("Invalid scan ticket");
    err.name = "ScanTicketError";
    throw err;
  }
  return decoded;
}
