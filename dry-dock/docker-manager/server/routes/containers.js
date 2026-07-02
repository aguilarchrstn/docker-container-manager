import { Router } from "express";
import { docker } from "../lib/docker.js";

export const containersRouter = Router();

function formatPorts(ports = []) {
  return ports
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`);
}

containersRouter.get("/", async (req, res) => {
  try {
    const list = await docker.listContainers({ all: true });
    const containers = list.map((c) => ({
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      name: (c.Names?.[0] || "").replace(/^\//, ""),
      image: c.Image,
      state: c.State, // running, exited, paused, created...
      status: c.Status, // "Up 3 hours", "Exited (0) 2 days ago"
      ports: formatPorts(c.Ports),
      created: c.Created,
    }));
    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

containersRouter.get("/:id", async (req, res) => {
  try {
    const info = await docker.getContainer(req.params.id).inspect();
    res.json({ container: info });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.get("/:id/logs", async (req, res) => {
  try {
    const tail = Number(req.query.tail) || 200;
    const container = docker.getContainer(req.params.id);
    const buffer = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: false,
    });

    // Docker multiplexes stdout/stderr with an 8-byte header per frame when
    // the container wasn't started with a TTY. Strip those header bytes so
    // logs render as plain, readable text.
    const text = demuxLogs(buffer);
    res.json({ logs: text });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

function demuxLogs(buffer) {
  if (!buffer || buffer.length === 0) return "";
  // Heuristic: if it doesn't look like docker's stream framing, return as-is.
  let out = "";
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const type = buffer[offset];
    if (type > 2) {
      // Not framed (TTY mode) — return the rest as plain text.
      out += buffer.slice(offset).toString("utf-8");
      break;
    }
    const size = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    out += buffer.slice(start, end).toString("utf-8");
    offset = end;
  }
  return out;
}

containersRouter.post("/:id/start", async (req, res) => {
  try {
    await docker.getContainer(req.params.id).start();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/stop", async (req, res) => {
  try {
    await docker.getContainer(req.params.id).stop();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/restart", async (req, res) => {
  try {
    await docker.getContainer(req.params.id).restart();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.delete("/:id", async (req, res) => {
  try {
    const force = req.query.force === "true";
    await docker.getContainer(req.params.id).remove({ force });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
