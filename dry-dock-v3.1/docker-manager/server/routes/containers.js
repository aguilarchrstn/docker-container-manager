import { Router } from "express";
import { registerContainerRoutes } from "../lib/containerHandlers.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const containersRouter = Router();

containersRouter.use(requireAuth, resolveEnvironment);

// Permission is checked BEFORE proxying to an agent-type environment —
// otherwise a view-only user could reach a manage action just by pointing
// it at a remote node, since the proxy would short-circuit the request
// before the route's own guard ran.
registerContainerRoutes(containersRouter, {
  viewGuards: [requirePermission(PERMISSIONS.CONTAINERS_VIEW), agentProxyPassthrough],
  manageGuards: [requirePermission(PERMISSIONS.CONTAINERS_MANAGE), agentProxyPassthrough],
});
