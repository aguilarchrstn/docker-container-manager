import { Router } from "express";
import { registerNetworkRoutes } from "../lib/volumeNetworkHandlers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const networksRouter = Router();

networksRouter.use(requireAuth, resolveEnvironment);

registerNetworkRoutes(networksRouter, {
  viewGuards: [requirePermission(PERMISSIONS.NETWORKS_VIEW), agentProxyPassthrough],
  manageGuards: [requirePermission(PERMISSIONS.NETWORKS_MANAGE), agentProxyPassthrough],
});
