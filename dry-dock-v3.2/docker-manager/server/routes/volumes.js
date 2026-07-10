import { Router } from "express";
import { registerVolumeRoutes } from "../lib/volumeNetworkHandlers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const volumesRouter = Router();

volumesRouter.use(requireAuth, resolveEnvironment);

registerVolumeRoutes(volumesRouter, {
  viewGuards: [requirePermission(PERMISSIONS.VOLUMES_VIEW), agentProxyPassthrough],
  manageGuards: [requirePermission(PERMISSIONS.VOLUMES_MANAGE), agentProxyPassthrough],
});
