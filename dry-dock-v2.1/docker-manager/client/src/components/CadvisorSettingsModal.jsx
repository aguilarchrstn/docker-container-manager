import { useState } from "react";
import { updateEnvironment, testCadvisorConnection } from "../api.js";

export default function CadvisorSettingsModal({ environment, onClose, onSaved }) {
  const isAgent = environment?.type === "agent";
  const [url, setUrl] = useState(environment?.config?.cadvisorUrl || "");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleTest() {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testCadvisorConnection(url.trim());
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateEnvironment(environment.id, { config: { cadvisorUrl: url.trim() } });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      await updateEnvironment(environment.id, { config: { cadvisorUrl: "" } });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(480px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Metrics source</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="form-body">
          {isAgent ? (
            <>
              <div className="field-hint">
                <strong>{environment.name}</strong> is connected through a Dry Dock Agent. Its cAdvisor URL
                is configured on that agent itself, not here — set <code>CADVISOR_URL</code> in the agent's
                environment and restart it. See the agent's README for details.
              </div>
              <div className="field-hint" style={{ marginTop: 10 }}>
                Once set there, this node's Monitoring metrics will automatically switch to cAdvisor — no
                change needed on this side.
              </div>
            </>
          ) : (
            <>
              <div className="field-hint" style={{ marginBottom: 12 }}>
                By default Dry Dock reads basic per-container stats from the Docker Engine directly. Point
                at a cAdvisor instance running on <strong>{environment?.name}</strong> for richer metrics —
                leave blank to use the Docker Engine default.
              </div>

              {error && <div className="banner error">{error}</div>}

              <label className="form-label">
                cAdvisor URL
                <input
                  className="form-input mono"
                  placeholder="http://localhost:8081 (or wherever it's published)"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setTestResult(null);
                  }}
                />
              </label>

              {testResult && (
                <div className={`banner ${testResult.ok ? "" : "error"}`}>
                  {testResult.ok
                    ? `Connected — ${testResult.numCores ?? "?"} cores reported`
                    : `Couldn't connect: ${testResult.error}`}
                </div>
              )}

              <div className="flex-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={handleTest} disabled={!url.trim() || testing}>
                  {testing ? "Testing…" : "Test connection"}
                </button>
                <span className="spacer" />
                {environment?.config?.cadvisorUrl && (
                  <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={saving}>
                    Use Docker Engine instead
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !url.trim()}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
