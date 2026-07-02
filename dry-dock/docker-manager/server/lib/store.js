import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEME_PATH = path.join(__dirname, "..", "data", "theme.json");
const PRESETS_PATH = path.join(__dirname, "..", "data", "presets.json");

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
