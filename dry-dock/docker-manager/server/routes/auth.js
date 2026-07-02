import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, getFullUser } from "../lib/db.js";
import { signToken, requireAuth } from "../lib/auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  const row = db
    .prepare("SELECT id, username, password_hash, disabled FROM users WHERE username = ?")
    .get(username.trim());
  if (!row || row.disabled) return res.status(401).json({ error: "Invalid credentials" });

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(row);
  res.json({ token, user: getFullUser(row.id) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword are required" });
  if (newPassword.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ ok: true });
});
