import { Router } from "express";
import { readCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { pingEnvironment } from "../lib/dockerPool.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePermission(PERMISSIONS.ENVIRONMENTS_VIEW));

// Pings every configured environment in parallel and returns a status card
// per node: online/offline, docker version, container/image counts. Kept
// as one call so the Dashboard page loads with a single request instead of
// one per node.
dashboardRouter.get("/", async (req, res) => {
  try {
    const environments = await readCollection("environments", []);
    const cards = await Promise.all(
      environments.map(async (env) => {
        const result = await pingEnvironment(env);
        return {
          id: env.id,
          name: env.name,
          type: env.type,
          description: env.description,
          online: result.ok,
          error: result.ok ? null : result.error,
          info: result.ok ? result.info : null,
        };
      })
    );
    res.json({ environments: cards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
