import express from "express";
import { Router } from "express";
import { registerContainerRoutes, registerImageRoutes } from "./lib/containerHandlers.js";
import { registerStackRoutes } from "./lib/stackHandlers.js";
import { registerVolumeRoutes, registerNetworkRoutes } from "./lib/volumeNetworkHandlers.js";
import { requireAgentToken, resolveEnvironment } from "./lib/auth.js";
import { assertDockerReachable, getDockerSummary, docker } from "./lib/docker.js";
import { getSystemStats } from "./lib/systemStats.js";
import { requestLogger, logger } from "./lib/logger.js";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());
app.use(requestLogger);

app.get("/health", async (req, res) => {
  res.json({ ok: await assertDockerReachable() });
});

const agentRouter = Router();
agentRouter.use(requireAgentToken);

// Returns the same {ok, info} shape the manager reports for local/
// standalone nodes, so this agent's environment card on the Dashboard
// shows real container/image/CPU/memory numbers instead of just a status
// dot with no data.
agentRouter.get("/ping", async (req, res) => {
  try {
    const reachable = await assertDockerReachable();
    if (!reachable) return res.json({ ok: false, error: "Docker Engine unreachable from this agent" });
    const info = await getDockerSummary(docker);
    res.json({ ok: true, name: "drydock-agent", info });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Host-level system stats (CPU/memory/swap/disk) for this node.
agentRouter.get("/system-stats", (req, res) => {
  try {
    res.json({ available: true, stats: getSystemStats() });
  } catch (err) {
    res.json({ available: false, reason: err.message });
  }
});

const containersRouter = Router();
containersRouter.use(resolveEnvironment);
registerContainerRoutes(containersRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/containers", containersRouter);

const imagesRouter = Router();
imagesRouter.use(resolveEnvironment);
registerImageRoutes(imagesRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/images", imagesRouter);

const stacksRouter = Router();
stacksRouter.use(resolveEnvironment);
registerStackRoutes(stacksRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/stacks", stacksRouter);

const volumesRouter = Router();
volumesRouter.use(resolveEnvironment);
registerVolumeRoutes(volumesRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/volumes", volumesRouter);

const networksRouter = Router();
networksRouter.use(resolveEnvironment);
registerNetworkRoutes(networksRouter, { viewGuards: [], manageGuards: [] });
agentRouter.use("/networks", networksRouter);

app.use("/api/agent", agentRouter);

app.listen(PORT, async () => {
  logger.info(`Dry Dock Agent listening on :${PORT}`);
  if (!process.env.AGENT_TOKEN) {
    logger.error(
      "AGENT_TOKEN is not set — every request will be rejected. Set AGENT_TOKEN and restart."
    );
  }
  await assertDockerReachable();
});
