import Docker from "dockerode";
import { docker as localDocker } from "./docker.js";
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
      return { ok: true, info: body };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  try {
    const client =
      env.type === "local" ? localDocker : buildStandaloneClient(env.config || {});
    const info = await client.info();
    return {
      ok: true,
      info: {
        serverVersion: info.ServerVersion,
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        images: info.Images,
        os: info.OperatingSystem,
        arch: info.Architecture,
        ncpu: info.NCPU,
        memTotal: info.MemTotal,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
