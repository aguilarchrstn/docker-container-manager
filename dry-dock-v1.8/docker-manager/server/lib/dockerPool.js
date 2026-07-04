import Docker from "dockerode";
import { docker as localDocker, getDockerSummary } from "./docker.js";
import { readCollection } from "./store.js";

// Caches one dockerode client per environment id so we're not reconnecting
// on every request. "local" and "standalone" environments both resolve to
// a real dockerode instance — the only difference is *how* it connects
// (unix socket vs TCP/SSH to another node's Docker Engine). "agent"
// environments never get a dockerode client here; they're proxied over
// HTTP to another Dry Dock instance instead (see routes/environments.js
// and middleware/environment.js).

const clientCache = new Map();

export async function getEnvironment(envId) {
  const environments = await readCollection("environments", []);
  return environments.find((e) => e.id === envId) || null;
}

export async function listEnvironments() {
  return readCollection("environments", []);
}

function buildStandaloneClient(config) {
  const { host, port, tls, ca, cert, key } = config;
  const opts = { host, port: Number(port) || 2375 };
  if (tls) {
    opts.protocol = "https";
    if (ca) opts.ca = ca;
    if (cert) opts.cert = cert;
    if (key) opts.key = key;
  } else {
    opts.protocol = "http";
  }
  return new Docker(opts);
}

// Returns a dockerode instance for a local/standalone environment, or null
// for an agent environment (caller should proxy instead).
export async function getEngine(envId) {
  if (!envId || envId === "local") return localDocker;

  if (clientCache.has(envId)) return clientCache.get(envId);

  const env = await getEnvironment(envId);
  if (!env) throw new Error(`Unknown environment: ${envId}`);
  if (env.type === "local") return localDocker;
  if (env.type === "agent") return null; // proxy path handles this

  if (env.type === "standalone") {
    const client = buildStandaloneClient(env.config || {});
    clientCache.set(envId, client);
    return client;
  }

  throw new Error(`Unsupported environment type: ${env.type}`);
}

export function invalidateEngine(envId) {
  clientCache.delete(envId);
}

// Stacks are implemented by shelling out to the `docker compose` CLI
// rather than reimplementing compose semantics over dockerode — this
// tells that child process which Docker Engine to talk to via DOCKER_HOST,
// mirroring how getEngine()/buildStandaloneClient() pick a target above.
// Only local/standalone resolve here — agent-type stack requests never
// reach this because they're proxied to the agent (which calls its own
// copy of this same function) before this code runs.
export async function composeEnvVars(envId) {
  if (!envId || envId === "local") {
    if (process.env.DOCKER_HOST) return { DOCKER_HOST: process.env.DOCKER_HOST };
    if (process.env.DOCKER_SOCKET_PATH) return { DOCKER_HOST: `unix://${process.env.DOCKER_SOCKET_PATH}` };
    return {};
  }

  const env = await getEnvironment(envId);
  if (!env) throw new Error(`Unknown environment: ${envId}`);
  if (env.type === "local") return composeEnvVars("local");

  if (env.type === "standalone") {
    if (env.config?.tls) {
      throw new Error(
        "Stacks don't support TLS-secured standalone nodes yet — use an unencrypted TCP endpoint for this feature, or manage this stack directly on that host."
      );
    }
    return { DOCKER_HOST: `tcp://${env.config.host}:${env.config.port || 2375}` };
  }

  throw new Error("This environment type doesn't support Stacks directly.");
}

// Used by the environment wizard's "Test connection" step and by the
// Dashboard's per-node status check.
export async function pingEnvironment(env) {
  if (env.type === "agent") {
    const base = (env.config?.baseUrl || "").replace(/\/$/, "");
    if (!base) return { ok: false, error: "Missing base URL" };
    try {
      const res = await fetch(`${base}/api/agent/ping`, {
        headers: { "x-agent-token": env.config?.agentToken || "" },
      });
      if (!res.ok) return { ok: false, error: `Agent responded ${res.status}` };
      const body = await res.json();
      // The agent's /ping response nests the actual Docker stats under
      // `info` (same shape a local/standalone node reports) — body.ok
      // reflects whether *that agent's* Docker Engine is reachable, which
      // can be false even though the HTTP call itself succeeded.
      if (!body.ok) return { ok: false, error: body.error || "Agent reports Docker unreachable" };
      return { ok: true, info: body.info };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  try {
    const client =
      env.type === "local" ? localDocker : buildStandaloneClient(env.config || {});
    const info = await getDockerSummary(client);
    return { ok: true, info };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
