import { Router } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db, getFullUser } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";

export const adminRouter = Router();

// Every admin endpoint requires the `admin` permission.
adminRouter.use(requirePermission("admin"));

// ---------------- Users ----------------
adminRouter.get("/users", (req, res) => {
  const rows = db.prepare("SELECT id FROM users ORDER BY created_at ASC").all();
  res.json({ users: rows.map((r) => getFullUser(r.id)) });
});

adminRouter.post("/users", (req, res) => {
  const { username, password, displayName, roleIds = [] } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });
  const id = randomUUID();
  try {
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, disabled, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).run(id, username.trim(), bcrypt.hashSync(password, 10), displayName?.trim() || null, Date.now());
    const stmt = db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
    for (const rid of roleIds) stmt.run(id, rid);
    res.status(201).json({ user: getFullUser(id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put("/users/:id", (req, res) => {
  const { displayName, disabled, password, roleIds } = req.body || {};
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "User not found" });
  if (displayName !== undefined) db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, req.params.id);
  if (disabled !== undefined) db.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, req.params.id);
  if (password) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), req.params.id);
  if (Array.isArray(roleIds)) {
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(req.params.id);
    const stmt = db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
    for (const rid of roleIds) stmt.run(req.params.id, rid);
  }
  res.json({ user: getFullUser(req.params.id) });
});

adminRouter.delete("/users/:id", (req, res) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: "You cannot delete your own account" });
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------------- Roles ----------------
adminRouter.get("/roles", (req, res) => {
  const roles = db.prepare("SELECT * FROM roles ORDER BY name ASC").all();
  const perms = db.prepare(
    `SELECT rp.role_id, p.key FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id`
  ).all();
  const permsByRole = {};
  for (const p of perms) (permsByRole[p.role_id] ||= []).push(p.key);
  res.json({ roles: roles.map((r) => ({ ...r, permissions: permsByRole[r.id] || [] })) });
});

adminRouter.post("/roles", (req, res) => {
  const { name, description, permissionKeys = [] } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, 0)").run(id, name.trim(), description || null);
    const findPerm = db.prepare("SELECT id FROM permissions WHERE key = ?");
    const insert = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const k of permissionKeys) {
      const p = findPerm.get(k);
      if (p) insert.run(id, p.id);
    }
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put("/roles/:id", (req, res) => {
  const role = db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
  if (!role) return res.status(404).json({ error: "Role not found" });
  const { description, permissionKeys } = req.body || {};
  if (description !== undefined) db.prepare("UPDATE roles SET description = ? WHERE id = ?").run(description, req.params.id);
  if (Array.isArray(permissionKeys)) {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(req.params.id);
    const findPerm = db.prepare("SELECT id FROM permissions WHERE key = ?");
    const insert = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const k of permissionKeys) {
      const p = findPerm.get(k);
      if (p) insert.run(req.params.id, p.id);
    }
  }
  res.json({ ok: true });
});

adminRouter.delete("/roles/:id", (req, res) => {
  const role = db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
  if (!role) return res.status(404).json({ error: "Role not found" });
  if (role.is_system) return res.status(400).json({ error: "System roles cannot be deleted" });
  db.prepare("DELETE FROM roles WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------------- Permissions ----------------
adminRouter.get("/permissions", (req, res) => {
  res.json({ permissions: db.prepare("SELECT * FROM permissions ORDER BY key ASC").all() });
});

// ---------------- Teams ----------------
adminRouter.get("/teams", (req, res) => {
  const teams = db.prepare("SELECT * FROM teams ORDER BY name ASC").all();
  const members = db.prepare(
    `SELECT tm.team_id, u.id, u.username, u.display_name FROM team_members tm
     JOIN users u ON u.id = tm.user_id`
  ).all();
  const byTeam = {};
  for (const m of members) (byTeam[m.team_id] ||= []).push({ id: m.id, username: m.username, displayName: m.display_name });
  res.json({ teams: teams.map((t) => ({ ...t, members: byTeam[t.id] || [] })) });
});

adminRouter.post("/teams", (req, res) => {
  const { name, description, memberIds = [] } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO teams (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(
      id, name.trim(), description || null, Date.now()
    );
    const stmt = db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)");
    for (const uid of memberIds) stmt.run(id, uid);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put("/teams/:id", (req, res) => {
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const { description, memberIds } = req.body || {};
  if (description !== undefined) db.prepare("UPDATE teams SET description = ? WHERE id = ?").run(description, req.params.id);
  if (Array.isArray(memberIds)) {
    db.prepare("DELETE FROM team_members WHERE team_id = ?").run(req.params.id);
    const stmt = db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)");
    for (const uid of memberIds) stmt.run(req.params.id, uid);
  }
  res.json({ ok: true });
});

adminRouter.delete("/teams/:id", (req, res) => {
  db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
