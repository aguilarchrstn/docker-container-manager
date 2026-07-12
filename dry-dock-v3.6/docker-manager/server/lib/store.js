import { readFile, writeFile, rename, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { isDatabaseConfigured, dbGet, dbSet } from "./db.js";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const THEME_PATH = path.join(DATA_DIR, "theme.json");
const PRESETS_PATH = path.join(DATA_DIR, "presets.json");

// ---------- generic collection helpers (users, teams, roles, environments, settings) ----------
// Two backends behind the exact same functions, chosen once via env vars
// (DATABASE_URL, or PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE) — set
// by the Compose Generator's Database step when PostgreSQL is enabled:
//   - Not configured (default): JSON files under server/data/, unchanged
//     from how this worked before Postgres support existed.
//   - Configured: rows in a small Postgres key-value table (see db.js).
// Every caller (users.js, teams.js, roles.js, environments.js, activity.js,
// settings.js, theme.js, presets.js) only ever calls these functions, so
// none of them need to know or care which backend is active.

function collectionPath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

// Concurrent writes to the SAME file (e.g. two requests both appending an
// activity log entry at once) used to race directly against each other —
// two overlapping writeFile() calls to one path can interleave at the OS
// level and corrupt the file (this is exactly what caused "Unexpected
// non-whitespace character after JSON" on boot: pruneActivityNow() tried
// to parse an activity.json that two earlier writes had corrupted).
// This queues writes to the same collection name so they run one at a
// time, and writes to a temp file + atomic rename so a crash mid-write
// can't leave a half-written file behind either.
const writeQueues = new Map();

function queueWrite(name, task) {
  const prev = writeQueues.get(name) || Promise.resolve();
  const next = prev.then(task, task); // run even if the previous write failed
  writeQueues.set(name, next);
  return next;
}

async function writeJsonAtomic(filePath, data) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmpPath, filePath); // atomic on POSIX filesystems
}

// If a collection file is corrupted (bad JSON — from before this file had
// write-serialization/atomic writes, or any other cause), don't take the
// whole app down on every boot. Log it clearly, move the bad file aside
// for inspection, and continue with `fallback` so Dry Dock can actually
// start — same principle as a browser recovering from a corrupted cache
// instead of refusing to load at all.
async function readJsonResilient(filePath, fallback) {
  let raw;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    const backupPath = `${filePath}.corrupted-${Date.now()}`;
    logger.error(
      `${path.basename(filePath)} contains invalid JSON and could not be read — moving it to ` +
        `${path.basename(backupPath)} and starting fresh for this collection. The corrupted file is ` +
        `preserved alongside it in case you want to recover anything from it by hand.`,
      { error: err.message }
    );
    try {
      await rename(filePath, backupPath);
    } catch {
      // best-effort — if we can't even rename it, still fall through and
      // let the app boot rather than crash on this file again
    }
    return fallback;
  }
}

export async function readCollection(name, fallback = []) {
  if (isDatabaseConfigured()) {
    return dbGet(name, fallback);
  }
  return readJsonResilient(collectionPath(name), fallback);
}

export async function writeCollection(name, data) {
  if (isDatabaseConfigured()) {
    return dbSet(name, data);
  }
  await queueWrite(name, () => writeJsonAtomic(collectionPath(name), data));
  return data;
}

export async function readSettings() {
  return readCollection("settings", {});
}

export async function writeSettings(settings) {
  return writeCollection("settings", settings);
}

// ---------- theme/preset helpers (same dual-backend treatment) ----------

export async function readTheme() {
  if (isDatabaseConfigured()) {
    const theme = await dbGet("theme", null);
    if (theme) return theme;
    // First boot against a fresh database — seed from the shipped default
    // theme.json so there's still a sensible starting palette.
    const fallback = await readJsonResilient(THEME_PATH, null);
    if (fallback) await dbSet("theme", fallback);
    return fallback;
  }
  return readJsonResilient(THEME_PATH, null);
}

export async function writeTheme(theme) {
  if (isDatabaseConfigured()) {
    return dbSet("theme", theme);
  }
  await queueWrite("theme", () => writeJsonAtomic(THEME_PATH, theme));
  return theme;
}

export async function readPresets() {
  if (isDatabaseConfigured()) {
    return dbGet("presets", []);
  }
  return readJsonResilient(PRESETS_PATH, []);
}

export async function writePresets(presets) {
  if (isDatabaseConfigured()) {
    return dbSet("presets", presets);
  }
  await queueWrite("presets", () => writeJsonAtomic(PRESETS_PATH, presets));
  return presets;
}
