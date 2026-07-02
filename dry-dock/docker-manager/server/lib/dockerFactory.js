import Docker from "dockerode";
import { db } from "./db.js";

// Cache of Docker clients keyed by environment id.
const clients = new Map();

function buildClient(env) {
  const cfg = JSON.parse(env.config_json || "{}");
  switch (env.kind) {
    case "local":
      return new Docker({ socketPath: cfg.socketPath || "/var/run/docker.sock" });
    case "tcp": {
      // Placeholder — v1 only exposes local; kept so the wizard's other options
      // work once TLS material is wired in.
      const opts = { host: cfg.host, port: cfg.port || 2375, protocol: cfg.tls ? "https" : "http" };
      if (cfg.tls && cfg.ca && cfg.cert && cfg.key) {
        opts.ca = cfg.ca;
        opts.cert = cfg.cert;
        opts.key = cfg.key;
      }
      return new Docker(opts);
    }
    case "ssh":
      return new Docker({ protocol: "ssh", host: cfg.host, port: cfg.port || 22, username: cfg.username });
    case "remote_node":
      // Federated Dry Dock node — not implemented in v1. Falls through to error.
      throw new Error("remote_node environments are not implemented yet");
    default:
      throw new Error(`Unknown environment kind: ${env.kind}`);
  }
}

export function getEnvironment(envId) {
  if (envId) {
    return db.prepare("SELECT * FROM environments WHERE id = ?").get(envId);
  }
  return (
    db.prepare("SELECT * FROM environments WHERE is_default = 1 LIMIT 1").get() ||
    db.prepare("SELECT * FROM environments ORDER BY created_at ASC LIMIT 1").get()
  );
}

export function getDockerForEnv(envId) {
  const env = getEnvironment(envId);
  if (!env) throw new Error("No environment configured");
  if (!clients.has(env.id)) clients.set(env.id, buildClient(env));
  return { docker: clients.get(env.id), env };
}

export function invalidateEnvClient(envId) {
  clients.delete(envId);
}

// Express middleware: reads env from header/query, attaches req.docker + req.env.
export function withDocker(req, res, next) {
  const envId = req.header("x-env-id") || req.query.envId;
  try {
    const { docker, env } = getDockerForEnv(envId);
    req.docker = docker;
    req.env = env;
    next();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function pingEnv(envId) {
  try {
    const { docker } = getDockerForEnv(envId);
    await docker.ping();
    const info = await docker.info();
    return {
      ok: true,
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      images: info.Images,
      serverVersion: info.ServerVersion,
      operatingSystem: info.OperatingSystem,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
