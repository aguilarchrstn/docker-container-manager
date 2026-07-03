import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const THEME_PATH = path.join(DATA_DIR, "theme.json");
const PRESETS_PATH = path.join(DATA_DIR, "presets.json");

// ---------- generic collection helpers (users, teams, roles, environments, settings) ----------
// Each collection is a single JSON file: data/<name>.json holding an array
// (or, for "settings", a single object). Small-scale JSON-file storage,
// consistent with how theme/presets already worked in this app pre-auth —
// no DB dependency required to stand this up.

function collectionPath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export async function readCollection(name, fallback = []) {
  try {
    const raw = await readFile(collectionPath(name), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeCollection(name, data) {
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

// ---------- existing theme/preset helpers (unchanged behavior) ----------

export async function readTheme() {
  const raw = await readFile(THEME_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function writeTheme(theme) {
  await writeFile(THEME_PATH, JSON.stringify(theme, null, 2), "utf-8");
  return theme;
}

export async function readPresets() {
  try {
    const raw = await readFile(PRESETS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function writePresets(presets) {
  await writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2), "utf-8");
  return presets;
}
