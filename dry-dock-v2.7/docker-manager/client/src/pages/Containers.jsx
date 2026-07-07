import { useCallback, useEffect, useState } from "react";
import {
  listContainers,
  startContainer,
  stopContainer,
  restartContainer,
  killContainer,
  pauseContainer,
  resumeContainer,
  removeContainer,
} from "../api.js";
import StatusDot from "../components/StatusDot.jsx";
import LogsModal from "../components/LogsModal.jsx";
import StatsModal from "../components/StatsModal.jsx";
import CreateContainerModal from "../components/CreateContainerModal.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useNodeLoading } from "../lib/useNodeLoading.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";

const BULK_ACTIONS = [
  { key: "start", label: "Start", fn: startContainer, variant: "btn-primary" },
  { key: "stop", label: "Stop", fn: stopContainer },
  { key: "restart", label: "Restart", fn: restartContainer },
  { key: "pause", label: "Pause", fn: pauseContainer },
  { key: "resume", label: "Resume", fn: resumeContainer },
  { key: "kill", label: "Kill", fn: killContainer, variant: "btn-danger" },
  {
    key: "remove",
    label: "Remove",
    fn: (id) => removeContainer(id, true),
    variant: "btn-danger",
    confirm: (n) => `Remove ${n} container${n > 1 ? "s" : ""}? This cannot be undone.`,
  },
];

export default function Containers() {
  const { currentId } = useEnvironment();
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useNodeLoading(loading);
  const [selected, setSelected] = useState(() => new Set());
  const [runningAction, setRunningAction] = useState(null);
  const [logsTarget, setLogsTarget] = useState(null);
  const [statsTarget, setStatsTarget] = useState(null);
  const [createMode, setCreateMode] = useState(null); // null | "pull" | "existing"

  const refresh = useCallback(() => {
    return listContainers()
      .then((data) => {
        setContainers(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Re-fetches whenever the selected node changes (topbar switcher or
  // Dashboard's "Manage this node"), not just on mount — previously
  // switching nodes here silently kept showing the old node's containers
  // until the next 5s poll happened to land.
  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh, currentId]);

  // Drop selections for containers that no longer exist (removed, etc.)
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(containers.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [containers]);

  // The Dry Dock container itself is never selectable — bulk actions
  // against it are blocked server-side too, but keeping it out of the UI
  // selection entirely avoids a confusing "action blocked" error.
  const selectable = containers.filter((c) => !c.isSelf);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)));
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function runBulk(action) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action.confirm && !confirm(action.confirm(ids.length))) return;

    setRunningAction(action.key);
    const results = await Promise.allSettled(ids.map((id) => action.fn(id)));
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length) {
      setError(`${action.label} failed for ${failures.length} of ${ids.length} container(s).`);
    } else {
      setError(null);
    }
    await refresh();
    if (action.key === "remove" && !failures.length) setSelected(new Set());
    setRunningAction(null);
  }

  const selectionCount = selected.size;

  if (showLoading) return <LoadingState label="Loading containers…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Containers</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={refresh}>Refresh</button>
          <button className="btn btn-sm" onClick={() => setCreateMode("existing")}>
            + From image
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setCreateMode("pull")}>
            + Add container
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {selectionCount > 0 && (
        <div className="bulk-toolbar">
          <span className="count">{selectionCount} selected</span>
          {BULK_ACTIONS.map((action) => (
            <button
              key={action.key}
              className={`btn btn-sm ${action.variant || ""}`}
              disabled={runningAction !== null}
              onClick={() => runBulk(action)}
            >
              {runningAction === action.key ? "…" : action.label}
            </button>
          ))}
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {containers.length === 0 ? (
        <div className="manifest">
          <div className="empty-state">
            <div className="title">No containers found</div>
            Add one with the button above, or run something with Docker and it'll show up here.
          </div>
        </div>
      ) : (
        <div className="manifest">
          <div className="manifest-header">
            <input
              type="checkbox"
              className="row-checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all containers"
            />
            <span />
            <span>Name</span>
            <span>Image</span>
            <span>Ports</span>
            <span>Status</span>
            <span></span>
          </div>
          {containers.map((c) => (
            <div className={`manifest-row ${selected.has(c.id) ? "selected" : ""}`} key={c.id}>
              <input
                type="checkbox"
                className="row-checkbox"
                checked={selected.has(c.id)}
                disabled={c.isSelf}
                onChange={() => toggleOne(c.id)}
                aria-label={`Select ${c.name}`}
                title={c.isSelf ? "Dry Dock can't act on itself" : undefined}
              />
              <StatusDot state={c.state} />
              <span className="name">
                {c.name}
                {c.isSelf && <span className="self-badge" title="This is the Dry Dock app itself">This app</span>}
              </span>
              <span className="mono">{c.image}</span>
              <span className="mono">{c.ports.join(", ") || "—"}</span>
              <span className="status-label">{c.status}</span>
              <div className="manifest-actions">
                <button className="btn btn-sm" onClick={() => setLogsTarget(c)}>
                  Logs
                </button>
                {c.state === "running" && (
                  <button className="btn btn-sm" onClick={() => setStatsTarget(c)}>
                    Stats
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {logsTarget && (
        <LogsModal container={logsTarget} onClose={() => setLogsTarget(null)} />
      )}

      {statsTarget && (
        <StatsModal container={statsTarget} onClose={() => setStatsTarget(null)} />
      )}

      {createMode && (
        <CreateContainerModal
          initialMode={createMode}
          onClose={() => setCreateMode(null)}
          onCreated={() => {
            setCreateMode(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
