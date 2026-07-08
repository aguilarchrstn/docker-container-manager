import { Router } from "express";
import { registerStackRoutes } from "../lib/stackHandlers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const stacksRouter = Router();

stacksRouter.use(requireAuth, resolveEnvironment);

registerStackRoutes(stacksRouter, {
  viewGuards: [requirePermission(PERMISSIONS.STACKS_VIEW), agentProxyPassthrough],
  manageGuards: [requirePermission(PERMISSIONS.STACKS_MANAGE), agentProxyPassthrough],
});
