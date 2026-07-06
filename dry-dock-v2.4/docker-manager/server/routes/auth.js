import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import {
  verifyPassword,
  hashPassword,
  signSession,
  getSessionDurationMs,
  SESSION_COOKIE,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../lib/activity.js";

export const authRouter = Router();

const BASE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
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
    if (!user) {
      await logActivity({ actorId: null, actorName: username, action: `Failed login attempt for "${username}"`, success: false });
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await logActivity({ actorId: user.id, actorName: user.username, action: "Failed login attempt", success: false });
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = await signSession(user);
    const maxAge = await getSessionDurationMs();
    res.cookie(SESSION_COOKIE, token, { ...BASE_COOKIE_OPTS, maxAge });
    const { passwordHash, ...safeUser } = user;
    await logActivity({ actorId: user.id, actorName: user.username, action: "Signed in", success: true });
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  await logActivity({ actorId: req.user.id, actorName: req.user.username, action: "Signed out", success: true });
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
    await logActivity({ actorId: req.user.id, actorName: req.user.username, action: "Changed their password", success: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Self-service profile update — deliberately separate from the admin
// users.js CRUD (which needs users.manage). Anyone can rename themselves;
// nobody can touch their own roles/username here.
authRouter.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body || {};
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: "Display name can't be empty" });
    }
    const users = await readCollection("users", []);
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].displayName = displayName.trim();
    await writeCollection("users", users);
    await logActivity({ actorId: req.user.id, actorName: req.user.username, action: "Updated their profile", success: true });
    const { passwordHash, ...safeUser } = users[idx];
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
