import jwt from "jsonwebtoken";
import { getFullUser, getUserPermissions } from "./db.js";

const SECRET = process.env.AUTH_SECRET || "dev-insecure-change-me";
const TOKEN_TTL = "7d";

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: TOKEN_TTL });
}

function readToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return null;
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = getFullUser(payload.sub);
    if (!user || user.disabled) return res.status(401).json({ error: "Not authenticated" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const perms = req.user.permissions || getUserPermissions(req.user.id);
    if (perms.includes("admin") || perms.includes(perm)) return next();
    res.status(403).json({ error: `Missing permission: ${perm}` });
  };
}
