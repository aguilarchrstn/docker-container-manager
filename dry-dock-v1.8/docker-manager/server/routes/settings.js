import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { readSettings, writeSettings } from "../lib/store.js";
import { PERMISSIONS } from "../lib/rbac.js";

export const settingsRouter = Router();

const DEFAULTS = {
  activityRetentionDays: 15,
  notificationsEnabled: true,
  sessionDurationDays: 7,
};

settingsRouter.use(requireAuth);

// Readable by any signed-in user — the notification bell and login-session
// behavior both depend on knowing these values, not just admins.
settingsRouter.get("/", async (req, res) => {
  try {
    const settings = await readSettings();
    res.json({
      activityRetentionDays: settings.activityRetentionDays ?? DEFAULTS.activityRetentionDays,
      notificationsEnabled: settings.notificationsEnabled ?? DEFAULTS.notificationsEnabled,
      sessionDurationDays: settings.sessionDurationDays ?? DEFAULTS.sessionDurationDays,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.put("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
  try {
    const { activityRetentionDays, notificationsEnabled, sessionDurationDays } = req.body || {};
    const settings = await readSettings();

    if (activityRetentionDays !== undefined) {
      const n = Number(activityRetentionDays);
      if (!Number.isFinite(n) || n < 1 || n > 365) {
        return res.status(400).json({ error: "Retention must be between 1 and 365 days" });
      }
      settings.activityRetentionDays = n;
    }
    if (notificationsEnabled !== undefined) {
      settings.notificationsEnabled = !!notificationsEnabled;
    }
    if (sessionDurationDays !== undefined) {
      const n = Number(sessionDurationDays);
      if (!Number.isFinite(n) || n < 1 || n > 90) {
        return res.status(400).json({ error: "Session duration must be between 1 and 90 days" });
      }
      settings.sessionDurationDays = n;
    }

    await writeSettings(settings);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
