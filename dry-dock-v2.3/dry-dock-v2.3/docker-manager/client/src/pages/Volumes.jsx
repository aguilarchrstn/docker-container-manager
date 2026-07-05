import { useCallback, useEffect, useState } from "react";
import { listVolumes, createVolume, removeVolume } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

const GRID = "2fr 1fr 1.4fr auto";

export default function Volumes() {
  const { currentId } = useEnvironment();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.VOLUMES_MANAGE);
  const [volumes, setVolumes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading, 500);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(() => {
    return listVolumes()
      .then((data) => { setVolumes(data); setError(null); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, currentId]);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      await createVolume({ name: newName.trim() });
      setNewName("");
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(name) {
    if (!confirm(`Remove volume "${name}"? Any data in it is gone for good.`)) return;
    setBusy(name);
    try {
      await removeVolume(name, true);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (showLoading) return <LoadingState label="Loading volumes…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Volumes</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating((c) => !c)}>
            + New volume
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {creating && (
        <form className="form-section-card" style={{ maxWidth: 480, marginBottom: 16 }} onSubmit={handleCreate}>
          <label className="form-label">
            Name
            <span className="field-hint">Leave blank for a random Docker-generated name.</span>
            <input className="form-input mono" placeholder="optional" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </label>
          <div className="flex-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy === "create"}>
              {busy === "create" ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {volumes.length === 0 ? (
        <div className="empty-state">
          <div className="title">No volumes on this node</div>
          <div>Volumes created by containers, or created here directly, show up in this list.</div>
        </div>
      ) : (
        <div className="resource-table">
          <div className="resource-table-header" style={{ gridTemplateColumns: GRID }}>
            <span>Name</span>
            <span>Driver</span>
            <span>Created</span>
            <span></span>
          </div>
          {volumes.map((v) => (
            <div className="resource-table-row" style={{ gridTemplateColumns: GRID }} key={v.name}>
              <span className="mono">{v.name}</span>
              <span>{v.driver}</span>
              <span className="field-hint">{v.created ? new Date(v.created).toLocaleString() : "—"}</span>
              <span className="resource-table-actions">
                {canManage && (
                  <button className="btn btn-sm btn-danger" disabled={busy === v.name} onClick={() => handleRemove(v.name)}>
                    {busy === v.name ? "…" : "Remove"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
