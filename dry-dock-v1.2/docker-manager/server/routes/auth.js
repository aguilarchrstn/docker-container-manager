import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import {
  verifyPassword,
  hashPassword,
  signSession,
  SESSION_COOKIE,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  // secure: true, // enable once served over HTTPS / behind a TLS-terminating proxy
};

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const users = await readCollection("users", []);
    const user = users.find(
      (u) => u.username.toLowerCase() === String(username).toLowerCase()
    );
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password" });

    const token = await signSession(user);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user, permissions: [...req.permissions] });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: "New password must be at least 4 characters" });
    }
    const users = await readCollection("users", []);
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    const ok = await verifyPassword(currentPassword || "", users[idx].passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    users[idx].passwordHash = await hashPassword(newPassword);
    users[idx].mustChangePassword = false;
    await writeCollection("users", users);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
