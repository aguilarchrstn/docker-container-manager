import { Router } from "express";
import { registerImageRoutes } from "../lib/containerHandlers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const imagesRouter = Router();

imagesRouter.use(requireAuth, resolveEnvironment);

registerImageRoutes(imagesRouter, {
  viewGuards: [requirePermission(PERMISSIONS.IMAGES_VIEW), agentProxyPassthrough],
  manageGuards: [requirePermission(PERMISSIONS.IMAGES_MANAGE), agentProxyPassthrough],
});
