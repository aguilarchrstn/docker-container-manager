import { Router } from "express";
import { registerContainerRoutes, registerImageRoutes } from "../lib/containerHandlers.js";
import { requireAgentToken, resolveEnvironment, agentProxyPassthrough } from "../middleware/environment.js";
import { getDockerSummary } from "../lib/docker.js";
import { getEngine, getEnvironment } from "../lib/dockerPool.js";

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

// Returns the same {ok, info} shape the manager's own Dashboard uses for
// local/standalone nodes, so an agent-connected environment shows real
// container/image/CPU/memory numbers instead of just an online/offline
// dot. If ?env points at one of THIS instance's own agent-type
// environments (a further chain hop), forwards the ping instead of
// reporting on the local node.
agentRouter.get("/ping", async (req, res) => {
  try {
    const envId = req.query.env || "local";
    const target = await getEnvironment(envId);
    if (!target) return res.json({ ok: false, error: `Unknown environment: ${envId}` });

    if (target.type === "agent") {
      const base = (target.config?.baseUrl || "").replace(/\/$/, "");
      const remoteEnvId = target.config?.remoteEnvironmentId || "local";
      const upstream = await fetch(`${base}/api/agent/ping?env=${encodeURIComponent(remoteEnvId)}`, {
        headers: { "x-agent-token": target.config?.agentToken || "" },
      });
      const body = await upstream.json();
      return res.json(body);
    }

    const docker = await getEngine(envId);
    const info = await getDockerSummary(docker);
    res.json({ ok: true, name: "drydock-agent", info });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

const containersRouter = Router();
containersRouter.use(resolveEnvironment, agentProxyPassthrough);
registerContainerRoutes(containersRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/containers", containersRouter);

const imagesRouter = Router();
imagesRouter.use(resolveEnvironment, agentProxyPassthrough);
registerImageRoutes(imagesRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/images", imagesRouter);
