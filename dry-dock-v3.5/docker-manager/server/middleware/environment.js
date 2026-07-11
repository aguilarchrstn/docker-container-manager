import { getEnvironment } from "../lib/dockerPool.js";
import { getAgentToken } from "../lib/auth.js";

// Every containers/images/stats route accepts ?env=<id> (defaults to
// "local"). This resolves that id to the stored environment record and
// attaches it as req.environment for downstream handlers.
export async function resolveEnvironment(req, res, next) {
  try {
    const envId = req.query.env || "local";
    const environment = await getEnvironment(envId);
    if (!environment) {
      return res.status(404).json({ error: `Unknown environment: ${envId}` });
    }
    req.environment = environment;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// If the resolved environment is type "agent" (another Dry Dock instance,
// possibly one that itself only has a route to yet another server), this
// forwards the request as-is to that instance's parallel /api/agent/*
// surface — authenticated with the environment's stored agent token
// instead of a user session — and pipes the response straight back.
// Local/standalone environments fall through to the normal route handler.
export function agentProxyPassthrough(req, res, next) {
  const env = req.environment;
  if (!env || env.type !== "agent") return next();

  const base = (env.config?.baseUrl || "").replace(/\/$/, "");
  const token = env.config?.agentToken || "";
  if (!base) return res.status(502).json({ error: "Agent environment has no base URL configured" });

  // The environment id in the original request (?env=<this-env-id>) is
  // only meaningful to us — the remote instance needs to know which of
  // ITS OWN environments to act on, which defaults to its "local" node
  // unless this environment was configured to reach further (a chain:
  // this Dry Dock -> that Dry Dock -> one of ITS standalone/agent nodes).
  const remoteEnvId = env.config?.remoteEnvironmentId || "local";

  // Derive the resource name ("containers" / "images") from how this
  // router is mounted rather than from the full original URL, so this
  // works whether we're the top-level /api/containers router or nested
  // one level deeper inside /api/agent/containers (a multi-hop chain).
  const resource = req.baseUrl.split("/").filter(Boolean).pop();
  const params = new URLSearchParams(req.query);
  params.set("env", remoteEnvId);
  const targetUrl = `${base}/api/agent/${resource}${req.path}?${params.toString()}`;

  (async () => {
    try {
      const init = {
        method: req.method,
        headers: { "x-agent-token": token, "Content-Type": "application/json" },
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        init.body = JSON.stringify(req.body || {});
      }
      const upstream = await fetch(targetUrl, init);
      res.status(upstream.status);
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);

      if (upstream.body) {
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      res.status(502).json({ error: `Agent proxy failed: ${err.message}` });
    }
  })();
}

// Guards the /api/agent/* surface that OTHER Dry Dock instances call into
// when this instance has been added as one of their "agent" environments.
export async function requireAgentToken(req, res, next) {
  const provided = req.headers["x-agent-token"];
  const expected = await getAgentToken();
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Invalid or missing agent token" });
  }
  next();
}
