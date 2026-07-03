import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { newId, getAgentToken, regenerateAgentToken } from "../lib/auth.js";
import { pingEnvironment, invalidateEngine } from "../lib/dockerPool.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const environmentsRouter = Router();

environmentsRouter.use(requireAuth);

// Strips secrets (TLS keys, agent tokens) before sending environment
// records to the client — the wizard writes them, but nothing needs to
// read them back.
function sanitize(env) {
  const { config, ...rest } = env;
  const safeConfig = { ...config };
  if (safeConfig.key) safeConfig.key = "••••••••";
  if (safeConfig.agentToken) safeConfig.agentToken = "••••••••";
  return { ...rest, config: safeConfig };
}

environmentsRouter.get("/", requirePermission(PERMISSIONS.ENVIRONMENTS_VIEW), async (req, res) => {
  try {
    const environments = await readCollection("environments", []);
    res.json({ environments: environments.map(sanitize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// This instance's own agent token + a ready-to-copy hint for whoever wants
// to add THIS Dry Dock as an "agent" environment on another instance.
environmentsRouter.get(
  "/agent-token",
  requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE),
  async (req, res) => {
    const token = await getAgentToken();
    res.json({ agentToken: token });
  }
);

environmentsRouter.post(
  "/agent-token/regenerate",
  requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE),
  async (req, res) => {
    try {
      const token = await regenerateAgentToken();
      res.json({ agentToken: token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Tests a connection before saving — used by the environment wizard's
// "Test connection" step. Body shape matches a would-be environment record.
environmentsRouter.post(
  "/test",
  requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE),
  async (req, res) => {
    const { type, config } = req.body || {};
    const result = await pingEnvironment({ type, config });
    res.json(result);
  }
);

environmentsRouter.post("/", requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE), async (req, res) => {
  try {
    const { name, description = "", type, config = {} } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (!["standalone", "agent"].includes(type)) {
      return res.status(400).json({ error: "type must be 'standalone' or 'agent'" });
    }
    if (type === "standalone" && !config.host) {
      return res.status(400).json({ error: "host is required for a standalone node" });
    }
    if (type === "agent" && !config.baseUrl) {
      return res.status(400).json({ error: "baseUrl is required for an agent node" });
    }

    const environments = await readCollection("environments", []);
    const env = {
      id: newId("env"),
      name: name.trim(),
      description,
      type,
      config,
      builtin: false,
      createdAt: new Date().toISOString(),
    };
    environments.push(env);
    await writeCollection("environments", environments);
    res.status(201).json({ environment: sanitize(env) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

environmentsRouter.put("/:id", requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE), async (req, res) => {
  try {
    const environments = await readCollection("environments", []);
    const idx = environments.findIndex((e) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Environment not found" });
    if (environments[idx].builtin) {
      return res.status(400).json({ error: "The local environment can't be edited" });
    }

    const { name, description, config } = req.body || {};
    if (name !== undefined) environments[idx].name = name.trim();
    if (description !== undefined) environments[idx].description = description;
    if (config !== undefined) {
      // Preserve masked secrets the client sends back unchanged.
      const merged = { ...environments[idx].config, ...config };
      if (config.key === "••••••••") merged.key = environments[idx].config.key;
      if (config.agentToken === "••••••••") merged.agentToken = environments[idx].config.agentToken;
      environments[idx].config = merged;
    }

    await writeCollection("environments", environments);
    invalidateEngine(req.params.id);
    res.json({ environment: sanitize(environments[idx]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

environmentsRouter.delete("/:id", requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE), async (req, res) => {
  try {
    const environments = await readCollection("environments", []);
    const target = environments.find((e) => e.id === req.params.id);
    if (target?.builtin) {
      return res.status(400).json({ error: "The local environment can't be removed" });
    }
    const next = environments.filter((e) => e.id !== req.params.id);
    await writeCollection("environments", next);
    invalidateEngine(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

environmentsRouter.get(
  "/:id/summary",
  requirePermission(PERMISSIONS.ENVIRONMENTS_VIEW),
  async (req, res) => {
    try {
      const environments = await readCollection("environments", []);
      const env = environments.find((e) => e.id === req.params.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const result = await pingEnvironment(env);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
