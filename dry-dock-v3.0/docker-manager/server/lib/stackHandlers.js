import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { composeEnvVars } from "./dockerPool.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STACKS_DIR = path.join(DATA_DIR, "stacks");
const STACKS_INDEX = path.join(DATA_DIR, "stacks.json");

// Used as both the on-disk filename and the `docker compose -p` project
// name, so keep it filesystem- and Compose-project-name safe.
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,50}$/;

async function readIndex() {
  try {
    return JSON.parse(await readFile(STACKS_INDEX, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeIndex(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STACKS_INDEX, JSON.stringify(list, null, 2), "utf-8");
}

function composeFilePath(id) {
  return path.join(STACKS_DIR, `${id}.yml`);
}

// Runs `docker compose -f <file> -p <id> <args>` against whichever Docker
// Engine `envId` resolves to. If `composeContent` is given, it's written
// to disk first (create/update); omit it to operate on a stack's existing
// file (start/stop/logs/remove).
async function runCompose(envId, args, composeContent, id) {
  await mkdir(STACKS_DIR, { recursive: true });
  const filePath = composeFilePath(id);
  if (composeContent !== undefined) {
    await writeFile(filePath, composeContent, "utf-8");
  }

  const extraEnv = await composeEnvVars(envId);
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["compose", "-f", filePath, "-p", id, ...args],
      { env: { ...process.env, ...extraEnv }, timeout: 180000, maxBuffer: 20 * 1024 * 1024 }
    );
    return { ok: true, stdout, stderr };
  } catch (err) {
    return { ok: false, stdout: err.stdout || "", stderr: err.stderr || err.message };
  }
}

export function registerStackRoutes(router, { viewGuards = [], manageGuards = [] } = {}) {
  router.get("/", ...viewGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const scoped = list.filter((s) => s.environmentId === req.environment.id);
      res.json({ stacks: scoped });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validates compose content — runs `docker compose config` (parses and
  // resolves the file, checking syntax and structure) against a throwaway
  // temp file, WITHOUT creating a stack record or starting anything. This
  // is what the "Test" button in the stack editor calls before Save/Deploy.
  router.post("/validate", ...manageGuards, async (req, res) => {
    const { compose } = req.body || {};
    if (!compose || !compose.trim()) {
      return res.status(400).json({ error: "compose content is required" });
    }
    const tmpFile = path.join(os.tmpdir(), `drydock-validate-${randomUUID()}.yml`);
    try {
      await writeFile(tmpFile, compose, "utf-8");
      const extraEnv = await composeEnvVars(req.environment.id);
      const { stdout } = await execFileAsync(
        "docker",
        ["compose", "-f", tmpFile, "config"],
        { env: { ...process.env, ...extraEnv }, timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
      );
      res.json({ ok: true, output: stdout });
    } catch (err) {
      res.json({ ok: false, error: err.stderr || err.message });
    } finally {
      rm(tmpFile, { force: true }).catch(() => {});
    }
  });

  router.get("/:id", ...viewGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const stack = list.find((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (!stack) return res.status(404).json({ error: "Stack not found" });
      let compose = "";
      try {
        compose = await readFile(composeFilePath(stack.id), "utf-8");
      } catch {
        // file missing is non-fatal — still show the stack's metadata
      }
      res.json({ stack: { ...stack, compose } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", ...manageGuards, async (req, res) => {
    try {
      const { name, compose, deploy = true } = req.body || {};
      if (!name || !NAME_RE.test(name)) {
        return res.status(400).json({
          error: "Name must be lowercase letters, numbers, and hyphens (used as the compose project name).",
        });
      }
      if (!compose || !compose.trim()) {
        return res.status(400).json({ error: "compose content is required" });
      }

      const list = await readIndex();
      if (list.some((s) => s.id === name)) {
        return res.status(409).json({ error: "A stack with that name already exists" });
      }

      const stack = {
        id: name,
        name,
        environmentId: req.environment.id,
        status: deploy ? "deploying" : "stopped",
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.push(stack);

      if (!deploy) {
        // Save only — write the compose file and record it, but don't run
        // `up`. Lets someone build up a stack and deploy it later (from
        // this list's Start button) instead of every save being live.
        await mkdir(STACKS_DIR, { recursive: true });
        await writeFile(composeFilePath(name), compose, "utf-8");
        await writeIndex(list);
        return res.status(201).json({ stack, stdout: "", stderr: "" });
      }

      await writeIndex(list);

      const result = await runCompose(req.environment.id, ["up", "-d", "--remove-orphans"], compose, name);
      stack.status = result.ok ? "running" : "error";
      stack.lastError = result.ok ? null : result.stderr;
      stack.updatedAt = new Date().toISOString();
      await writeIndex(list);

      res.status(result.ok ? 201 : 500).json({ stack, stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/:id", ...manageGuards, async (req, res) => {
    try {
      const { compose } = req.body || {};
      if (!compose || !compose.trim()) return res.status(400).json({ error: "compose content is required" });

      const list = await readIndex();
      const idx = list.findIndex((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (idx === -1) return res.status(404).json({ error: "Stack not found" });

      list[idx].status = "deploying";
      await writeIndex(list);

      const result = await runCompose(req.environment.id, ["up", "-d", "--remove-orphans"], compose, list[idx].id);
      list[idx].status = result.ok ? "running" : "error";
      list[idx].lastError = result.ok ? null : result.stderr;
      list[idx].updatedAt = new Date().toISOString();
      await writeIndex(list);

      res.json({ stack: list[idx], stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/:id/stop", ...manageGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const idx = list.findIndex((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (idx === -1) return res.status(404).json({ error: "Stack not found" });

      const result = await runCompose(req.environment.id, ["down"], undefined, list[idx].id);
      list[idx].status = result.ok ? "stopped" : "error";
      list[idx].lastError = result.ok ? null : result.stderr;
      list[idx].updatedAt = new Date().toISOString();
      await writeIndex(list);
      res.json({ stack: list[idx], stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/:id/start", ...manageGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const idx = list.findIndex((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (idx === -1) return res.status(404).json({ error: "Stack not found" });

      const result = await runCompose(req.environment.id, ["up", "-d"], undefined, list[idx].id);
      list[idx].status = result.ok ? "running" : "error";
      list[idx].lastError = result.ok ? null : result.stderr;
      list[idx].updatedAt = new Date().toISOString();
      await writeIndex(list);
      res.json({ stack: list[idx], stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/:id/logs", ...viewGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const stack = list.find((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (!stack) return res.status(404).json({ error: "Stack not found" });

      const tail = String(Number(req.query.tail) || 200);
      const result = await runCompose(req.environment.id, ["logs", "--no-color", "--tail", tail], undefined, stack.id);
      res.json({ logs: result.stdout || result.stderr || "" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", ...manageGuards, async (req, res) => {
    try {
      const list = await readIndex();
      const idx = list.findIndex((s) => s.id === req.params.id && s.environmentId === req.environment.id);
      if (idx === -1) return res.status(404).json({ error: "Stack not found" });

      await runCompose(req.environment.id, ["down", "-v", "--remove-orphans"], undefined, list[idx].id);
      const next = list.filter((s) => s.id !== req.params.id);
      await writeIndex(next);
      try {
        await rm(composeFilePath(req.params.id));
      } catch {
        // already gone — fine
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
