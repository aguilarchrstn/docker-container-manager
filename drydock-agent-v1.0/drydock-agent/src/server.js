/**
 * Dry Dock Agent
 * ----------------
 * A small HTTP daemon that runs on a remote host next to Docker and exposes
 * a controlled, authenticated JSON API + raw Docker socket proxy so the
 * Dry Dock manager can drive that host without opening the Docker daemon to
 * the network directly.
 *
 * Run with:
 *   docker run -d \
 *     -p 4001:4001 \
 *     --name drydock_agent \
 *     --restart=always \
 *     -e AGENT_TOKEN=change-me \
 *     -v /var/run/docker.sock:/var/run/docker.sock \
 *     -v /var/lib/docker/volumes:/var/lib/docker/volumes \
 *     -v /:/host:ro \
 *     drydock/agent:1.0
 */

const express = require("express");
const morgan = require("morgan");
const http = require("http");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const Docker = require("dockerode");

const PORT = parseInt(process.env.AGENT_PORT || "4001", 10);
const HOST = process.env.AGENT_HOST || "0.0.0.0";
const SOCKET_PATH = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const HOST_ROOT = process.env.HOST_ROOT || "/host";
const AGENT_VERSION = "1.0.0";

// -------- Auth token --------------------------------------------------------
// If AGENT_TOKEN is not provided, generate one on first boot and persist it
// so the manager can be paired with the agent using the printed value.
let AGENT_TOKEN = process.env.AGENT_TOKEN;
const TOKEN_FILE = "/data/agent-token";
if (!AGENT_TOKEN) {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      AGENT_TOKEN = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    } else {
      AGENT_TOKEN = crypto.randomBytes(24).toString("hex");
      try {
        fs.mkdirSync("/data", { recursive: true });
        fs.writeFileSync(TOKEN_FILE, AGENT_TOKEN, { mode: 0o600 });
      } catch {
        /* /data not writable — token is ephemeral for this run */
      }
    }
  } catch {
    AGENT_TOKEN = crypto.randomBytes(24).toString("hex");
  }
}

const docker = new Docker({ socketPath: SOCKET_PATH });

const app = express();
app.use(morgan("tiny"));
app.use(express.json({ limit: "5mb" }));

// -------- Middleware --------------------------------------------------------
function auth(req, res, next) {
  // /health and /version are unauthenticated so operators can probe the agent.
  if (req.path === "/health" || req.path === "/version") return next();
  const header = req.headers["authorization"] || "";
  const token =
    header.startsWith("Bearer ") ? header.slice(7) : req.headers["x-agent-token"];
  if (!token || token !== AGENT_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}
app.use(auth);

// -------- Meta endpoints ----------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true, agent: "drydock", version: AGENT_VERSION });
});

app.get("/version", (_req, res) => {
  res.json({
    agent: "drydock-agent",
    version: AGENT_VERSION,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  });
});

app.get("/info", async (_req, res, next) => {
  try {
    const [info, version, df] = await Promise.all([
      docker.info(),
      docker.version(),
      docker.df().catch(() => null),
    ]);
    res.json({
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
      docker: { info, version, df },
    });
  } catch (err) {
    next(err);
  }
});

// -------- Docker JSON helpers (thin convenience wrappers) -------------------
app.get("/containers", async (req, res, next) => {
  try {
    const all = String(req.query.all ?? "true") !== "false";
    res.json(await docker.listContainers({ all }));
  } catch (err) { next(err); }
});

app.get("/images", async (_req, res, next) => {
  try { res.json(await docker.listImages()); } catch (err) { next(err); }
});

app.get("/volumes", async (_req, res, next) => {
  try { res.json(await docker.listVolumes()); } catch (err) { next(err); }
});

app.get("/networks", async (_req, res, next) => {
  try { res.json(await docker.listNetworks()); } catch (err) { next(err); }
});

// Container lifecycle
const actions = ["start", "stop", "restart", "pause", "unpause", "kill"];
for (const action of actions) {
  app.post(`/containers/:id/${action}`, async (req, res, next) => {
    try {
      const c = docker.getContainer(req.params.id);
      await c[action]();
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}

app.delete("/containers/:id", async (req, res, next) => {
  try {
    await docker.getContainer(req.params.id).remove({ force: req.query.force === "true", v: req.query.v === "true" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/containers/:id/logs", async (req, res, next) => {
  try {
    const tail = parseInt(String(req.query.tail || "200"), 10);
    const stream = await docker.getContainer(req.params.id).logs({
      stdout: true, stderr: true, tail, follow: false, timestamps: true,
    });
    res.type("text/plain").send(Buffer.isBuffer(stream) ? stream.toString("utf8") : stream);
  } catch (err) { next(err); }
});

// Compose up: accept a docker-compose YAML string and project name; write to
// /data and shell out to `docker compose`. Requires docker CLI in the image.
app.post("/compose/up", async (req, res, next) => {
  try {
    const { project, yaml } = req.body || {};
    if (!project || !yaml) return res.status(400).json({ error: "project and yaml required" });
    const safe = String(project).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safe) return res.status(400).json({ error: "invalid project name" });
    const dir = `/data/compose/${safe}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/docker-compose.yml`, yaml);
    const { spawn } = require("child_process");
    const p = spawn("docker", ["compose", "-p", safe, "-f", `${dir}/docker-compose.yml`, "up", "-d"], { stdio: "pipe" });
    let out = ""; let err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => {
      res.status(code === 0 ? 200 : 500).json({ code, stdout: out, stderr: err });
    });
  } catch (err) { next(err); }
});

// -------- Raw Docker socket proxy ------------------------------------------
// Anything under /docker/* is forwarded 1:1 to the Docker Engine API on the
// unix socket. This lets the manager reuse Dockerode against the agent as if
// it were a remote TCP Docker daemon.
app.use("/docker", (req, res) => {
  const options = {
    socketPath: SOCKET_PATH,
    path: req.originalUrl.replace(/^\/docker/, "") || "/",
    method: req.method,
    headers: { ...req.headers, host: "docker" },
  };
  delete options.headers["content-length"];
  const proxy = http.request(options, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on("error", (err) => {
    res.status(502).json({ error: "docker_socket_error", detail: err.message });
  });
  req.pipe(proxy);
});

// -------- Error handler -----------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("[agent]", err);
  res.status(err.statusCode || 500).json({ error: err.message || "internal_error" });
});

app.listen(PORT, HOST, () => {
  console.log(`Dry Dock agent ${AGENT_VERSION} listening on ${HOST}:${PORT}`);
  console.log(`Docker socket: ${SOCKET_PATH}`);
  console.log(`Host root mount: ${HOST_ROOT}`);
  if (!process.env.AGENT_TOKEN) {
    console.log("");
    console.log("============================================================");
    console.log(" AGENT PAIRING TOKEN (use this in Dry Dock manager):");
    console.log(` ${AGENT_TOKEN}`);
    console.log("============================================================");
  }
});
