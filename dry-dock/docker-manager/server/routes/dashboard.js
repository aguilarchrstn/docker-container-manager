import { Router } from "express";
import { db } from "../lib/db.js";
import { pingEnv } from "../lib/dockerFactory.js";
import { requirePermission } from "../lib/auth.js";

export const dashboardRouter = Router();

// One aggregated call so the Dashboard can render everything from a single fetch.
dashboardRouter.get("/", requirePermission("envs.read"), async (req, res) => {
  const envs = db.prepare("SELECT * FROM environments ORDER BY is_default DESC, created_at ASC").all();
  const nodes = await Promise.all(
    envs.map(async (env) => {
      const health = await pingEnv(env.id);
      return {
        id: env.id,
        name: env.name,
        kind: env.kind,
        isDefault: !!env.is_default,
        ...health,
      };
    })
  );
  const totals = nodes.reduce(
    (acc, n) => {
      if (n.ok) {
        acc.nodesOnline += 1;
        acc.containers += n.containers || 0;
        acc.containersRunning += n.containersRunning || 0;
        acc.images += n.images || 0;
      } else {
        acc.nodesOffline += 1;
      }
      return acc;
    },
    { nodesOnline: 0, nodesOffline: 0, containers: 0, containersRunning: 0, images: 0 }
  );
  res.json({ nodes, totals });
});
