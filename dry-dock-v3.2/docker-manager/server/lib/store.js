import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { isDatabaseConfigured, dbGet, dbSet } from "./db.js";

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

export async function readCollection(name, fallback = []) {
  if (isDatabaseConfigured()) {
    return dbGet(name, fallback);
  }
  try {
    const raw = await readFile(collectionPath(name), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeCollection(name, data) {
  if (isDatabaseConfigured()) {
    return dbSet(name, data);
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(collectionPath(name), JSON.stringify(data, null, 2), "utf-8");
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
    const raw = await readFile(THEME_PATH, "utf-8");
    const fallback = JSON.parse(raw);
    await dbSet("theme", fallback);
    return fallback;
  }
  const raw = await readFile(THEME_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function writeTheme(theme) {
  if (isDatabaseConfigured()) {
    return dbSet("theme", theme);
  }
  await writeFile(THEME_PATH, JSON.stringify(theme, null, 2), "utf-8");
  return theme;
}

export async function readPresets() {
  if (isDatabaseConfigured()) {
    return dbGet("presets", []);
  }
  try {
    const raw = await readFile(PRESETS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function writePresets(presets) {
  if (isDatabaseConfigured()) {
    return dbSet("presets", presets);
  }
  await writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2), "utf-8");
  return presets;
}
