import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEME_PATH = path.join(__dirname, "..", "data", "theme.json");

export async function readTheme() {
  const raw = await readFile(THEME_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function writeTheme(theme) {
  await writeFile(THEME_PATH, JSON.stringify(theme, null, 2), "utf-8");
  return theme;
}
