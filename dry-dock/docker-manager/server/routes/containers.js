import { Router } from "express";
import { docker } from "../lib/docker.js";
import { isSelfContainer } from "../lib/self.js";
import { summarizeStats } from "../lib/stats.js";

export const containersRouter = Router();

function formatPorts(ports = []) {
  return ports
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`);
}

// Blocks destructive actions against the Dry Dock container itself — taking
// itself down mid-request would just orphan the UI with no way to recover
// short of shelling into the host.
async function blockIfSelf(req, res, next) {
  if (await isSelfContainer(req.params.id)) {
    return res.status(409).json({
      error: "This is the Dry Dock container itself — that action is blocked to avoid taking the app down.",
    });
  }
  next();
}

containersRouter.get("/", async (req, res) => {
  try {
    const list = await docker.listContainers({ all: true });
    const containers = await Promise.all(
      list.map(async (c) => ({
        id: c.Id,
        shortId: c.Id.slice(0, 12),
        name: (c.Names?.[0] || "").replace(/^\//, ""),
        image: c.Image,
        state: c.State, // running, exited, paused, created...
        status: c.Status, // "Up 3 hours", "Exited (0) 2 days ago"
        ports: formatPorts(c.Ports),
        created: c.Created,
        isSelf: await isSelfContainer(c.Id),
      }))
    );
    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live metrics for every running container in one call, so the Monitoring
// page can poll a single endpoint instead of one request per container.
containersRouter.get("/stats/summary", async (req, res) => {
  try {
    const running = await docker.listContainers({ all: false });
    const stats = await Promise.all(
      running.map(async (c) => {
        try {
          const raw = await docker.getContainer(c.Id).stats({ stream: false });
          return {
            id: c.Id,
            shortId: c.Id.slice(0, 12),
            name: (c.Names?.[0] || "").replace(/^\//, ""),
            ...summarizeStats(raw),
          };
        } catch (err) {
          return {
            id: c.Id,
            name: (c.Names?.[0] || "").replace(/^\//, ""),
            error: err.message,
          };
        }
      })
    );
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

containersRouter.get("/:id/stats", async (req, res) => {
  try {
    const raw = await docker.getContainer(req.params.id).stats({ stream: false });
    res.json({ stats: summarizeStats(raw) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
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

containersRouter.post("/:id/stop", blockIfSelf, async (req, res) => {
  try {
    await docker.getContainer(req.params.id).stop();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/restart", blockIfSelf, async (req, res) => {
  try {
    await docker.getContainer(req.params.id).restart();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/kill", blockIfSelf, async (req, res) => {
  try {
    await docker.getContainer(req.params.id).kill();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/pause", blockIfSelf, async (req, res) => {
  try {
    await docker.getContainer(req.params.id).pause();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.post("/:id/unpause", async (req, res) => {
  try {
    await docker.getContainer(req.params.id).unpause();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Creates (and by default starts) a new container.
// Body: { image, name?, ports?: [{host, container, protocol}], env?: [{key, value}],
//         command?, restartPolicy?: "no"|"always"|"unless-stopped"|"on-failure", start?: bool }
containersRouter.post("/", async (req, res) => {
  try {
    const {
      image,
      name,
      ports = [],
      env = [],
      command,
      restartPolicy = "no",
      start = true,
    } = req.body || {};

    if (!image || !image.trim()) {
      return res.status(400).json({ error: "image is required" });
    }

    const ExposedPorts = {};
    const PortBindings = {};
    for (const p of ports) {
      if (!p.container) continue;
      const key = `${p.container}/${p.protocol || "tcp"}`;
      ExposedPorts[key] = {};
      if (p.host) PortBindings[key] = [{ HostPort: String(p.host) }];
    }

    const Env = env
      .filter((e) => e.key && e.key.trim())
      .map((e) => `${e.key.trim()}=${e.value ?? ""}`);

    const createOpts = {
      Image: image.trim(),
      name: name?.trim() || undefined,
      Cmd: command?.trim() ? command.trim().split(/\s+/) : undefined,
      Env: Env.length ? Env : undefined,
      ExposedPorts: Object.keys(ExposedPorts).length ? ExposedPorts : undefined,
      HostConfig: {
        PortBindings: Object.keys(PortBindings).length ? PortBindings : undefined,
        RestartPolicy:
          restartPolicy && restartPolicy !== "no"
            ? { Name: restartPolicy }
            : undefined,
      },
    };

    let container;
    try {
      container = await docker.createContainer(createOpts);
    } catch (err) {
      if (err.statusCode === 404) {
        // Image isn't present locally yet — pull it once, then retry.
        const stream = await docker.pull(image.trim());
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (pullErr) =>
            pullErr ? reject(pullErr) : resolve()
          );
        });
        container = await docker.createContainer(createOpts);
      } else {
        throw err;
      }
    }

    if (start) await container.start();

    res.status(201).json({ id: container.id });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.delete("/:id", blockIfSelf, async (req, res) => {
  try {
    const force = req.query.force === "true";
    await docker.getContainer(req.params.id).remove({ force });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
