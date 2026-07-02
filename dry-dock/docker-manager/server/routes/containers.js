import { Router } from "express";
import { withDocker } from "../lib/dockerFactory.js";
import { isSelfContainer } from "../lib/self.js";
import { summarizeStats } from "../lib/stats.js";
import { requirePermission } from "../lib/auth.js";

export const containersRouter = Router();

// Every route needs a docker client bound to the caller's selected env.
containersRouter.use(withDocker);

const canRead = requirePermission("containers.read");
const canWrite = requirePermission("containers.write");

function formatPorts(ports = []) {
  return ports
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`);
}

// Blocks destructive actions against the Dry Dock container itself.
async function blockIfSelf(req, res, next) {
  if (await isSelfContainer(req.docker, req.params.id)) {
    return res.status(409).json({
      error: "This is the Dry Dock container itself — that action is blocked to avoid taking the app down.",
    });
  }
  next();
}

containersRouter.get("/", canRead, async (req, res) => {
  try {
    const list = await req.docker.listContainers({ all: true });
    const containers = await Promise.all(
      list.map(async (c) => ({
        id: c.Id,
        shortId: c.Id.slice(0, 12),
        name: (c.Names?.[0] || "").replace(/^\//, ""),
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: formatPorts(c.Ports),
        created: c.Created,
        isSelf: await isSelfContainer(req.docker, c.Id),
      }))
    );
    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

containersRouter.get("/stats/summary", canRead, async (req, res) => {
  try {
    const running = await req.docker.listContainers({ all: false });
    const stats = await Promise.all(
      running.map(async (c) => {
        try {
          const raw = await req.docker.getContainer(c.Id).stats({ stream: false });
          return {
            id: c.Id,
            shortId: c.Id.slice(0, 12),
            name: (c.Names?.[0] || "").replace(/^\//, ""),
            ...summarizeStats(raw),
          };
        } catch (err) {
          return { id: c.Id, name: (c.Names?.[0] || "").replace(/^\//, ""), error: err.message };
        }
      })
    );
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

containersRouter.get("/:id/stats", canRead, async (req, res) => {
  try {
    const raw = await req.docker.getContainer(req.params.id).stats({ stream: false });
    res.json({ stats: summarizeStats(raw) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.get("/:id", canRead, async (req, res) => {
  try {
    const info = await req.docker.getContainer(req.params.id).inspect();
    res.json({ container: info });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

containersRouter.get("/:id/logs", canRead, async (req, res) => {
  try {
    const tail = Number(req.query.tail) || 200;
    const container = req.docker.getContainer(req.params.id);
    const buffer = await container.logs({ stdout: true, stderr: true, tail, timestamps: false });
    res.json({ logs: demuxLogs(buffer) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

function demuxLogs(buffer) {
  if (!buffer || buffer.length === 0) return "";
  let out = "";
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const type = buffer[offset];
    if (type > 2) {
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

const lifecycle = (action, guard = null) => async (req, res) => {
  try {
    await req.docker.getContainer(req.params.id)[action]();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

containersRouter.post("/:id/start", canWrite, lifecycle("start"));
containersRouter.post("/:id/stop", canWrite, blockIfSelf, lifecycle("stop"));
containersRouter.post("/:id/restart", canWrite, blockIfSelf, lifecycle("restart"));
containersRouter.post("/:id/kill", canWrite, blockIfSelf, lifecycle("kill"));
containersRouter.post("/:id/pause", canWrite, blockIfSelf, lifecycle("pause"));
containersRouter.post("/:id/unpause", canWrite, lifecycle("unpause"));

containersRouter.post("/", canWrite, async (req, res) => {
  try {
    const { image, name, ports = [], env = [], command, restartPolicy = "no", start = true } = req.body || {};
    if (!image || !image.trim()) return res.status(400).json({ error: "image is required" });

    const ExposedPorts = {};
    const PortBindings = {};
    for (const p of ports) {
      if (!p.container) continue;
      const key = `${p.container}/${p.protocol || "tcp"}`;
      ExposedPorts[key] = {};
      if (p.host) PortBindings[key] = [{ HostPort: String(p.host) }];
    }

    const Env = env.filter((e) => e.key && e.key.trim()).map((e) => `${e.key.trim()}=${e.value ?? ""}`);

    const createOpts = {
      Image: image.trim(),
      name: name?.trim() || undefined,
      Cmd: command?.trim() ? command.trim().split(/\s+/) : undefined,
      Env: Env.length ? Env : undefined,
      ExposedPorts: Object.keys(ExposedPorts).length ? ExposedPorts : undefined,
      HostConfig: {
        PortBindings: Object.keys(PortBindings).length ? PortBindings : undefined,
        RestartPolicy: restartPolicy && restartPolicy !== "no" ? { Name: restartPolicy } : undefined,
      },
    };

    let container;
    try {
      container = await req.docker.createContainer(createOpts);
    } catch (err) {
      if (err.statusCode === 404) {
        const stream = await req.docker.pull(image.trim());
        await new Promise((resolve, reject) => {
          req.docker.modem.followProgress(stream, (pullErr) => (pullErr ? reject(pullErr) : resolve()));
        });
        container = await req.docker.createContainer(createOpts);
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

containersRouter.delete("/:id", canWrite, blockIfSelf, async (req, res) => {
  try {
    const force = req.query.force === "true";
    await req.docker.getContainer(req.params.id).remove({ force });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
