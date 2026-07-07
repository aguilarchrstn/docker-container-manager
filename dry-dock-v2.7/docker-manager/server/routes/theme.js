import { Router } from "express";
import { readTheme, writeTheme } from "../lib/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const themeRouter = Router();

themeRouter.use(requireAuth);

themeRouter.get("/", async (req, res) => {
  try {
    const theme = await readTheme();
    res.json({ theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

themeRouter.put("/", requirePermission(PERMISSIONS.APPEARANCE_MANAGE), async (req, res) => {
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
