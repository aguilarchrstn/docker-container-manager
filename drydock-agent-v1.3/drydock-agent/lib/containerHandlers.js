import { getEngine } from "./dockerPool.js";
import { isSelfContainer } from "./self.js";
import { summarizeStats } from "./stats.js";
import { fetchCadvisorStats, fetchCadvisorStatsForOne } from "./cadvisor.js";

function formatPorts(ports = []) {
  return ports
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`);
}

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

async function blockIfSelf(req, res, next) {
  if (req.environment.id === "local" && (await isSelfContainer(req.params.id))) {
    return res.status(409).json({
      error: "This is the Dry Dock container itself — that action is blocked to avoid taking the app down.",
    });
  }
  next();
}

// Registers every container route on `router`, gating "view" endpoints
// behind `viewGuards` and "manage" (mutating) endpoints behind
// `manageGuards`. Used both for the user-facing router (session auth +
// fine-grained permissions) and the agent router (a single shared-secret
// guard, since a caller holding the agent token is already fully trusted).
export function registerContainerRoutes(router, { viewGuards = [], manageGuards = [] } = {}) {
  router.get("/", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const list = await docker.listContainers({ all: true });
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
          isSelf: req.environment.id === "local" ? await isSelfContainer(c.Id) : false,
        }))
      );
      res.json({ containers });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/stats/summary", ...viewGuards, async (req, res) => {
    const cadvisorUrl = req.environment?.config?.cadvisorUrl || process.env.CADVISOR_URL;
    if (cadvisorUrl) {
      try {
        const stats = await fetchCadvisorStats(cadvisorUrl);
        return res.json({ stats, source: "cadvisor" });
      } catch (err) {
        return res.status(502).json({ error: `cAdvisor: ${err.message}` });
      }
    }
    try {
      const docker = await getEngine(req.environment.id);
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
            return { id: c.Id, name: (c.Names?.[0] || "").replace(/^\//, ""), error: err.message };
          }
        })
      );
      res.json({ stats, source: "docker" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/:id/stats", ...viewGuards, async (req, res) => {
    const cadvisorUrl = req.environment?.config?.cadvisorUrl || process.env.CADVISOR_URL;
    if (cadvisorUrl) {
      try {
        const stats = await fetchCadvisorStatsForOne(cadvisorUrl, req.params.id);
        return res.json({ stats, source: "cadvisor" });
      } catch (err) {
        return res.status(502).json({ error: `cAdvisor: ${err.message}` });
      }
    }
    try {
      const docker = await getEngine(req.environment.id);
      const raw = await docker.getContainer(req.params.id).stats({ stream: false });
      res.json({ stats: summarizeStats(raw), source: "docker" });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get("/:id", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const info = await docker.getContainer(req.params.id).inspect();
      res.json({ container: info });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get("/:id/logs", ...viewGuards, async (req, res) => {
    try {
      const tail = Number(req.query.tail) || 200;
      const docker = await getEngine(req.environment.id);
      const container = docker.getContainer(req.params.id);
      const buffer = await container.logs({ stdout: true, stderr: true, tail, timestamps: false });
      res.json({ logs: demuxLogs(buffer) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/start", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).start();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/stop", ...manageGuards, blockIfSelf, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).stop();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/restart", ...manageGuards, blockIfSelf, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).restart();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/kill", ...manageGuards, blockIfSelf, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).kill();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/pause", ...manageGuards, blockIfSelf, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).pause();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/:id/unpause", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getContainer(req.params.id).unpause();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
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
        container = await docker.createContainer(createOpts);
      } catch (err) {
        if (err.statusCode === 404) {
          const stream = await docker.pull(image.trim());
          await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (pullErr) => (pullErr ? reject(pullErr) : resolve()));
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

  router.delete("/:id", ...manageGuards, blockIfSelf, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const force = req.query.force === "true";
      await docker.getContainer(req.params.id).remove({ force });
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}

export function registerImageRoutes(router, { viewGuards = [], manageGuards = [] } = {}) {
  router.get("/", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const list = await docker.listImages();
      const images = list.map((img) => ({
        id: img.Id,
        shortId: img.Id.replace("sha256:", "").slice(0, 12),
        tags: img.RepoTags || [],
        size: img.Size,
        created: img.Created,
      }));
      res.json({ images });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/pull", ...manageGuards, async (req, res) => {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: "image is required" });

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      const docker = await getEngine(req.environment.id);
      const stream = await docker.pull(image);
      docker.modem.followProgress(
        stream,
        (err) => {
          if (err) res.write(JSON.stringify({ error: err.message }) + "\n");
          res.end();
        },
        (event) => res.write(JSON.stringify(event) + "\n")
      );
    } catch (err) {
      res.write(JSON.stringify({ error: err.message }) + "\n");
      res.end();
    }
  });

  router.delete("/:id", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const force = req.query.force === "true";
      await docker.getImage(req.params.id).remove({ force });
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}
