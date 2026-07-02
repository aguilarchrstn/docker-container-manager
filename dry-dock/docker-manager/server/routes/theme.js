import { Router } from "express";
import { readTheme, writeTheme } from "../lib/store.js";

export const themeRouter = Router();

themeRouter.get("/", async (req, res) => {
  try {
    const theme = await readTheme();
    res.json({ theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

themeRouter.put("/", async (req, res) => {
  try {
    const { theme } = req.body || {};
    if (!theme || !theme.colors) {
      return res.status(400).json({ error: "theme.colors is required" });
    }
    const saved = await writeTheme(theme);
    res.json({ theme: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
