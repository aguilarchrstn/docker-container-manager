import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { newId } from "../lib/auth.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const teamsRouter = Router();

teamsRouter.use(requireAuth, requirePermission(PERMISSIONS.TEAMS_MANAGE));

teamsRouter.get("/", async (req, res) => {
  try {
    const teams = await readCollection("teams", []);
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

teamsRouter.post("/", async (req, res) => {
  try {
    const { name, description = "", memberIds = [], roleIds = [] } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const teams = await readCollection("teams", []);
    const team = {
      id: newId("team"),
      name: name.trim(),
      description,
      memberIds,
      roleIds,
      builtin: false,
    };
    teams.push(team);
    await writeCollection("teams", teams);
    res.status(201).json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

teamsRouter.put("/:id", async (req, res) => {
  try {
    const { name, description, memberIds, roleIds } = req.body || {};
    const teams = await readCollection("teams", []);
    const idx = teams.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Team not found" });

    if (name !== undefined) teams[idx].name = name.trim();
    if (description !== undefined) teams[idx].description = description;
    if (memberIds !== undefined) teams[idx].memberIds = memberIds;
    if (roleIds !== undefined) teams[idx].roleIds = roleIds;

    await writeCollection("teams", teams);
    res.json({ team: teams[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

teamsRouter.delete("/:id", async (req, res) => {
  try {
    const teams = await readCollection("teams", []);
    const target = teams.find((t) => t.id === req.params.id);
    if (target?.builtin) {
      return res.status(400).json({ error: "The default team can't be deleted" });
    }
    const next = teams.filter((t) => t.id !== req.params.id);
    await writeCollection("teams", next);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
