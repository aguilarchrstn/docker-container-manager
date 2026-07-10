import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { hashPassword, newId } from "../lib/auth.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE));

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

usersRouter.get("/", async (req, res) => {
  try {
    const users = await readCollection("users", []);
    res.json({ users: users.map(sanitize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.post("/", async (req, res) => {
  try {
    const { username, password, displayName, roleIds = [] } = req.body || {};
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const users = await readCollection("users", []);
    if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(409).json({ error: "That username is already taken" });
    }
    const user = {
      id: newId("user"),
      username: username.trim(),
      displayName: displayName?.trim() || username.trim(),
      passwordHash: await hashPassword(password),
      roleIds,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeCollection("users", users);

    // New users default into the built-in "Everyone" team, if present.
    const teams = await readCollection("teams", []);
    const everyone = teams.find((t) => t.builtin);
    if (everyone && !everyone.memberIds.includes(user.id)) {
      everyone.memberIds.push(user.id);
      await writeCollection("teams", teams);
    }

    res.status(201).json({ user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.put("/:id", async (req, res) => {
  try {
    const { displayName, roleIds, password } = req.body || {};
    const users = await readCollection("users", []);
    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    if (displayName !== undefined) users[idx].displayName = displayName.trim();
    if (roleIds !== undefined) users[idx].roleIds = roleIds;
    if (password) users[idx].passwordHash = await hashPassword(password);

    await writeCollection("users", users);
    res.json({ user: sanitize(users[idx]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

usersRouter.delete("/:id", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }
    const users = await readCollection("users", []);
    const target = users.find((u) => u.id === req.params.id);
    if (target?.username === "admin") {
      return res.status(400).json({ error: "The default admin account can't be deleted" });
    }
    const next = users.filter((u) => u.id !== req.params.id);
    await writeCollection("users", next);

    const teams = await readCollection("teams", []);
    for (const team of teams) {
      team.memberIds = (team.memberIds || []).filter((id) => id !== req.params.id);
    }
    await writeCollection("teams", teams);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
