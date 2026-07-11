import { useCallback, useEffect, useState } from "react";
import { listStacks, startStack, stopStack, deleteStack, getStackLogs } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import StackEditorModal from "../components/StackEditorModal.jsx";
import { useNodeLoading } from "../lib/useNodeLoading.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

const STATUS_LABEL = {
  running: "Running",
  stopped: "Stopped",
  deploying: "Deploying…",
  error: "Error",
};

export default function Stacks() {
  const { currentId } = useEnvironment();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.STACKS_MANAGE);
  const [stacks, setStacks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useNodeLoading(loading);
  const [busyId, setBusyId] = useState(null);
  const [editorStack, setEditorStack] = useState(null); // null | {} (new) | stack (edit)
  const [logsFor, setLogsFor] = useState(null);
  const [logsText, setLogsText] = useState("");

  const refresh = useCallback(() => {
    return listStacks()
      .then((data) => {
        setStacks(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setStacks([]);
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh, currentId]);

  async function handleStart(id) {
    setBusyId(id);
    try {
      await startStack(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleStop(id) {
    setBusyId(id);
    try {
      await stopStack(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(stack) {
    if (!confirm(`Remove stack "${stack.name}"? This tears down its containers and volumes.`)) return;
    setBusyId(stack.id);
    try {
      await deleteStack(stack.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewLogs(stack) {
    setLogsFor(stack);
    setLogsText("Loading…");
    try {
      const logs = await getStackLogs(stack.id);
      setLogsText(logs || "(no output)");
    } catch (err) {
      setLogsText(`Error: ${err.message}`);
    }
  }

  if (showLoading) return <LoadingState label="Loading stacks…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Stacks</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditorStack({})}>
            + New stack
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {stacks.length === 0 ? (
        <div className="empty-state">
          <div className="title">No stacks on this node yet</div>
          <div>Deploy a docker-compose file as a stack to manage a group of services together.</div>
        </div>
      ) : (
        <div className="admin-table">
          <div className="admin-table-header">
            <span>Name</span>
            <span className="col-center">Status</span>
            <span className="col-center">Last updated</span>
            <span></span>
          </div>
          {stacks.map((s) => (
            <div className="admin-table-row" key={s.id}>
              <span className="mono">{s.name}</span>
              <span className="col-center">
                <span className={`led ${s.status === "running" ? "running" : s.status === "error" ? "dead" : "exited"}`} />{" "}
                {STATUS_LABEL[s.status] || s.status}
              </span>
              <span className="field-hint col-center">{new Date(s.updatedAt).toLocaleString()}</span>
              <span className="admin-table-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => handleViewLogs(s)}>Logs</button>
                {canManage && (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditorStack(s)}>Edit</button>
                    {s.status === "running" ? (
                      <button className="btn btn-sm" disabled={busyId === s.id} onClick={() => handleStop(s.id)}>
                        {busyId === s.id ? "…" : "Stop"}
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-primary" disabled={busyId === s.id} onClick={() => handleStart(s.id)}>
                        {busyId === s.id ? "…" : "Start"}
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" disabled={busyId === s.id} onClick={() => handleRemove(s)}>
                      Remove
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {editorStack !== null && (
        <StackEditorModal
          stack={editorStack.id ? editorStack : null}
          onClose={() => setEditorStack(null)}
          onSaved={() => {
            setEditorStack(null);
            refresh();
          }}
        />
      )}

      {logsFor && (
        <div className="modal-overlay" onClick={() => setLogsFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{logsFor.name} — logs</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setLogsFor(null)}>Close</button>
            </div>
            <pre className="logs-body">{logsText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
