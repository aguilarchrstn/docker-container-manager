import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";
import { invalidateEnvClient, pingEnv } from "../lib/dockerFactory.js";

export const environmentsRouter = Router();

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    config: JSON.parse(row.config_json || "{}"),
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}

environmentsRouter.get("/", requirePermission("envs.read"), (req, res) => {
  const rows = db.prepare("SELECT * FROM environments ORDER BY is_default DESC, created_at ASC").all();
  res.json({ environments: rows.map(serialize) });
});

environmentsRouter.get("/:id/ping", requirePermission("envs.read"), async (req, res) => {
  const result = await pingEnv(req.params.id);
  res.json(result);
});

environmentsRouter.post("/", requirePermission("envs.write"), (req, res) => {
  const { name, kind, config = {}, isDefault } = req.body || {};
  if (!name?.trim() || !kind) return res.status(400).json({ error: "name and kind are required" });
  const ALLOWED = ["local", "tcp", "ssh", "remote_node"];
  if (!ALLOWED.includes(kind)) return res.status(400).json({ error: `kind must be one of ${ALLOWED.join(", ")}` });
  const id = randomUUID();
  try {
    if (isDefault) db.prepare("UPDATE environments SET is_default = 0").run();
    db.prepare(
      "INSERT INTO environments (id, name, kind, config_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name.trim(), kind, JSON.stringify(config), isDefault ? 1 : 0, Date.now());
    res.status(201).json({ environment: serialize(db.prepare("SELECT * FROM environments WHERE id = ?").get(id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

environmentsRouter.put("/:id", requirePermission("envs.write"), (req, res) => {
  const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Environment not found" });
  const { name, config, isDefault } = req.body || {};
  if (name?.trim()) db.prepare("UPDATE environments SET name = ? WHERE id = ?").run(name.trim(), req.params.id);
  if (config) db.prepare("UPDATE environments SET config_json = ? WHERE id = ?").run(JSON.stringify(config), req.params.id);
  if (isDefault) {
    db.prepare("UPDATE environments SET is_default = 0").run();
    db.prepare("UPDATE environments SET is_default = 1 WHERE id = ?").run(req.params.id);
  }
  invalidateEnvClient(req.params.id);
  res.json({ environment: serialize(db.prepare("SELECT * FROM environments WHERE id = ?").get(req.params.id)) });
});

environmentsRouter.delete("/:id", requirePermission("envs.write"), (req, res) => {
  const count = db.prepare("SELECT COUNT(*) AS n FROM environments").get().n;
  if (count <= 1) return res.status(400).json({ error: "At least one environment must remain" });
  db.prepare("DELETE FROM environments WHERE id = ?").run(req.params.id);
  invalidateEnvClient(req.params.id);
  res.json({ ok: true });
});

// Ping-before-save: lets the wizard test a would-be config without persisting.
environmentsRouter.post("/test", requirePermission("envs.write"), async (req, res) => {
  const { kind, config = {} } = req.body || {};
  try {
    const Docker = (await import("dockerode")).default;
    let client;
    switch (kind) {
      case "local":
        client = new Docker({ socketPath: config.socketPath || "/var/run/docker.sock" });
        break;
      case "tcp":
        client = new Docker({ host: config.host, port: config.port || 2375, protocol: config.tls ? "https" : "http" });
        break;
      case "ssh":
        client = new Docker({ protocol: "ssh", host: config.host, port: config.port || 22, username: config.username });
        break;
      default:
        return res.status(400).json({ ok: false, error: `${kind} is not supported in this build yet` });
    }
    await client.ping();
    const info = await client.info();
    res.json({ ok: true, serverVersion: info.ServerVersion, os: info.OperatingSystem });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
