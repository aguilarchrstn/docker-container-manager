import { useCallback, useEffect, useState } from "react";
import { listNetworks, createNetwork, removeNetwork } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

const GRID = "1.6fr 0.8fr 1fr 0.8fr auto";
const BUILTIN_NAMES = new Set(["bridge", "host", "none"]);

function emptyForm() {
  return { name: "", driver: "bridge", subnet: "", internal: false, attachable: true };
}

export default function Networks() {
  const { currentId } = useEnvironment();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.NETWORKS_MANAGE);
  const [networks, setNetworks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading, 500);
  const [form, setForm] = useState(null); // null = closed
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(() => {
    return listNetworks()
      .then((data) => { setNetworks(data); setError(null); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, currentId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      await createNetwork(form);
      setForm(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(net) {
    if (!confirm(`Remove network "${net.name}"?`)) return;
    setBusy(net.id);
    try {
      await removeNetwork(net.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (showLoading) return <LoadingState label="Loading networks…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Networks</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setForm(emptyForm())}>
            + New network
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {form && (
        <form className="form-section-card" style={{ maxWidth: 480, marginBottom: 16 }} onSubmit={handleCreate}>
          <label className="form-label">
            Name *
            <input className="form-input mono" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </label>
          <label className="form-label">
            Driver
            <select className="form-input" value={form.driver} onChange={(e) => setForm((f) => ({ ...f, driver: e.target.value }))}>
              <option value="bridge">bridge</option>
              <option value="overlay">overlay</option>
              <option value="macvlan">macvlan</option>
            </select>
          </label>
          <label className="form-label">
            Subnet
            <input className="form-input mono" placeholder="optional, e.g. 172.20.0.0/16" value={form.subnet} onChange={(e) => setForm((f) => ({ ...f, subnet: e.target.value }))} />
          </label>
          <label className="form-checkbox">
            <input type="checkbox" checked={form.internal} onChange={(e) => setForm((f) => ({ ...f, internal: e.target.checked }))} />
            Internal (no external connectivity)
          </label>
          <label className="form-checkbox">
            <input type="checkbox" checked={form.attachable} onChange={(e) => setForm((f) => ({ ...f, attachable: e.target.checked }))} />
            Attachable (containers can join manually)
          </label>
          <div className="flex-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy === "create"}>
              {busy === "create" ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {networks.length === 0 ? (
        <div className="empty-state">
          <div className="title">No networks on this node</div>
        </div>
      ) : (
        <div className="resource-table">
          <div className="resource-table-header" style={{ gridTemplateColumns: GRID }}>
            <span>Name</span>
            <span>Driver</span>
            <span>Subnet</span>
            <span>Containers</span>
            <span></span>
          </div>
          {networks.map((n) => (
            <div className="resource-table-row" style={{ gridTemplateColumns: GRID }} key={n.id}>
              <span className="mono">{n.name}</span>
              <span>{n.driver}</span>
              <span className="field-hint">{n.subnet || "—"}</span>
              <span>{n.containerCount}</span>
              <span className="resource-table-actions">
                {canManage && !BUILTIN_NAMES.has(n.name) && (
                  <button className="btn btn-sm btn-danger" disabled={busy === n.id} onClick={() => handleRemove(n)}>
                    {busy === n.id ? "…" : "Remove"}
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
