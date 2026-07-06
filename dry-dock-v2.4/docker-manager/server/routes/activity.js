import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { listActivity, clearActivity } from "../lib/activity.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const activityRouter = Router();

activityRouter.use(requireAuth, requirePermission(PERMISSIONS.ACTIVITY_VIEW));

activityRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const since = req.query.since || undefined;
    const activity = await listActivity({ limit, since });
    res.json({ activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

activityRouter.delete("/", requirePermission(PERMISSIONS.ACTIVITY_MANAGE), async (req, res) => {
  try {
    await clearActivity();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
