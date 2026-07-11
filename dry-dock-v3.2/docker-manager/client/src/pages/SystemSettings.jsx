import { useEffect, useState } from "react";
import { getAppSettings, updateAppSettings } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

export default function SystemSettings() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.SETTINGS_MANAGE);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((s) => {
        setSettings(s);
        setForm(s);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAppSettings(form);
      setSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return error ? <div className="banner error">{error}</div> : <LoadingState label="Loading settings…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Settings</h2>
      </div>

      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner">Saved.</div>}

      <form className="form-section-card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h3>Activity & logs</h3>
        <div className="field-hint" style={{ marginBottom: 16 }}>
          How long entries stay in the Activity log before being automatically pruned (checked hourly).
        </div>
        <label className="form-label">
          Retention (days)
          <input
            className="form-input"
            type="number"
            min={1}
            max={365}
            value={form.activityRetentionDays}
            disabled={!canManage}
            onChange={(e) => setForm((f) => ({ ...f, activityRetentionDays: Number(e.target.value) }))}
          />
        </label>

        <h3 style={{ marginTop: 24 }}>Notifications</h3>
        <div className="field-hint" style={{ marginBottom: 16 }}>
          Show an in-app notification when new activity happens, in addition to the bell in the topbar.
        </div>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={form.notificationsEnabled}
            disabled={!canManage}
            onChange={(e) => setForm((f) => ({ ...f, notificationsEnabled: e.target.checked }))}
          />
          Enable activity notifications
        </label>

        <h3 style={{ marginTop: 24 }}>Authentication</h3>
        <div className="field-hint" style={{ marginBottom: 16 }}>
          How long a signed-in session lasts before requiring login again.
        </div>
        <label className="form-label">
          Session duration (days)
          <input
            className="form-input"
            type="number"
            min={1}
            max={90}
            value={form.sessionDurationDays}
            disabled={!canManage}
            onChange={(e) => setForm((f) => ({ ...f, sessionDurationDays: Number(e.target.value) }))}
          />
          <span className="field-hint">Applies to sessions created after this is saved — existing sessions keep their original expiry.</span>
        </label>
        <label className="form-label" style={{ marginTop: 16 }}>
          Auto sign-out after inactivity (minutes)
          <input
            className="form-input"
            type="number"
            min={0}
            max={1440}
            value={form.autoLogoutMinutes}
            disabled={!canManage}
            onChange={(e) => setForm((f) => ({ ...f, autoLogoutMinutes: Number(e.target.value) }))}
          />
          <span className="field-hint">Signs everyone out after this many minutes with no mouse/keyboard/scroll activity. Set to 0 to disable.</span>
        </label>

        {canManage && (
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        )}
      </form>
    </div>
  );
}
