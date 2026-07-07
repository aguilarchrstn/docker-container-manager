import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { getSystemStats } from "../lib/systemStats.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const systemStatsRouter = Router();

systemStatsRouter.use(requireAuth, resolveEnvironment);

// Host-level CPU/memory/swap/disk for the Monitoring page's "System"
// gauges. Only meaningful where Dry Dock code is actually running on the
// node in question:
//   - "local"      -> computed directly, right here
//   - "agent"       -> proxied through to that node's Dry Dock Agent,
//                      which computes it the same way on its own host
//   - "standalone"  -> nothing runs there but the raw Docker Engine, so
//                      there's no way to read host-level stats — reported
//                      as unavailable rather than guessed at
systemStatsRouter.get(
  "/",
  requirePermission(PERMISSIONS.CONTAINERS_VIEW),
  agentProxyPassthrough,
  (req, res) => {
    if (req.environment.type === "standalone") {
      return res.json({
        available: false,
        reason:
          "Host-level system stats aren't available over a direct standalone connection — only container-level Docker stats are. Connect this node through a Dry Dock Agent to get system stats too.",
      });
    }
    res.json({ available: true, stats: getSystemStats() });
  }
);
