import { Router } from "express";
import { readCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { pingEnvironment } from "../lib/dockerPool.js";
import { getCachedHealth } from "../lib/healthPoller.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePermission(PERMISSIONS.ENVIRONMENTS_VIEW));

// Reads from the background health poller's cache (refreshed every 20s
// independent of whether this page is even open) rather than pinging
// every node live on every request — makes the Dashboard load instantly
// and means status stays fresh even when nobody's looking at it. Falls
// back to a live ping only for a brand-new environment the poller hasn't
// gotten to yet.
dashboardRouter.get("/", async (req, res) => {
  try {
    const environments = await readCollection("environments", []);
    const cards = await Promise.all(
      environments.map(async (env) => {
        let result = getCachedHealth(env.id);
        if (!result) result = await pingEnvironment(env);
        return {
          id: env.id,
          name: env.name,
          type: env.type,
          description: env.description,
          online: result.ok,
          error: result.ok ? null : result.error,
          info: result.ok ? result.info : null,
          checkedAt: result.checkedAt || Date.now(),
        };
      })
    );
    res.json({ environments: cards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
