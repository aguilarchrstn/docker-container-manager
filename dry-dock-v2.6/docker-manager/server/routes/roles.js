import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { newId } from "../lib/auth.js";
import { PERMISSIONS, ALL_PERMISSIONS } from "../lib/rbac.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE));

rolesRouter.get("/", async (req, res) => {
  try {
    const roles = await readCollection("roles", []);
    res.json({ roles, availablePermissions: ALL_PERMISSIONS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rolesRouter.post("/", async (req, res) => {
  try {
    const { name, description = "", permissions = [] } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const roles = await readCollection("roles", []);
    const role = {
      id: newId("role"),
      name: name.trim(),
      description,
      permissions: permissions.filter((p) => ALL_PERMISSIONS.includes(p)),
      builtin: false,
    };
    roles.push(role);
    await writeCollection("roles", roles);
    res.status(201).json({ role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rolesRouter.put("/:id", async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    const roles = await readCollection("roles", []);
    const idx = roles.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Role not found" });

    if (name !== undefined) roles[idx].name = name.trim();
    if (description !== undefined) roles[idx].description = description;
    if (permissions !== undefined) {
      roles[idx].permissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    }

    await writeCollection("roles", roles);
    res.json({ role: roles[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rolesRouter.delete("/:id", async (req, res) => {
  try {
    const roles = await readCollection("roles", []);
    const target = roles.find((r) => r.id === req.params.id);
    if (target?.builtin) {
      return res.status(400).json({ error: "Built-in roles can't be deleted" });
    }
    const next = roles.filter((r) => r.id !== req.params.id);
    await writeCollection("roles", next);

    // Clean up dangling references so users/teams don't point at a
    // deleted role.
    const users = await readCollection("users", []);
    for (const u of users) u.roleIds = (u.roleIds || []).filter((id) => id !== req.params.id);
    await writeCollection("users", users);

    const teams = await readCollection("teams", []);
    for (const t of teams) t.roleIds = (t.roleIds || []).filter((id) => id !== req.params.id);
    await writeCollection("teams", teams);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
