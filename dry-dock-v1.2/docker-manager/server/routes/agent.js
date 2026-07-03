import { Router } from "express";
import { registerContainerRoutes, registerImageRoutes } from "../lib/containerHandlers.js";
import { requireAgentToken, resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { assertDockerReachable } from "../lib/docker.js";

// Mounted at /api/agent. Another Dry Dock instance calls in here when it
// has this instance configured as an "agent"-type environment. Auth is a
// shared secret (x-agent-token) instead of a user session — whoever holds
// the token is treated as fully trusted, same as holding this box's own
// admin session would be. ?env=<id> selects which of THIS instance's own
// environments to act on (defaults to "local"), which is what makes
// multi-hop chains possible: A -> agent-token -> B -> (B's own standalone
// or agent environment) -> C.
export const agentRouter = Router();

agentRouter.use(requireAgentToken);

agentRouter.get("/ping", async (req, res) => {
  const ok = await assertDockerReachable();
  res.json({ ok, name: "drydock-agent" });
});

const containersRouter = Router();
containersRouter.use(resolveEnvironment, agentProxyPassthrough);
registerContainerRoutes(containersRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/containers", containersRouter);

const imagesRouter = Router();
imagesRouter.use(resolveEnvironment, agentProxyPassthrough);
registerImageRoutes(imagesRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/images", imagesRouter);
