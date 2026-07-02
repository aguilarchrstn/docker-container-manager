import { useCallback, useEffect, useState } from "react";
import {
  listContainers,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
} from "../api.js";
import StatusDot from "../components/StatusDot.jsx";
import LogsModal from "../components/LogsModal.jsx";

export default function Containers() {
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [logsTarget, setLogsTarget] = useState(null);

  const refresh = useCallback(() => {
    return listContainers()
      .then((data) => {
        setContainers(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function runAction(id, action) {
    setBusyId(id);
    try {
      if (action === "start") await startContainer(id);
      if (action === "stop") await stopContainer(id);
      if (action === "restart") await restartContainer(id);
      if (action === "remove") {
        if (!confirm("Remove this container? This cannot be undone.")) return;
        await removeContainer(id, true);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="status-label">Loading containers…</p>;

  return (
    <div>
      <div className="section-heading">
        <h2>Containers</h2>
        <button className="btn btn-sm" onClick={refresh}>Refresh</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      {containers.length === 0 ? (
        <div className="manifest">
          <div className="empty-state">
            <div className="title">No containers found</div>
            Run something with Docker and it'll show up here.
          </div>
        </div>
      ) : (
        <div className="manifest">
          <div className="manifest-header">
            <span />
            <span>Name</span>
            <span>Image</span>
            <span>Ports</span>
            <span>Status</span>
            <span></span>
          </div>
          {containers.map((c) => (
            <div className="manifest-row" key={c.id}>
              <StatusDot state={c.state} />
              <span className="name">{c.name}</span>
              <span className="mono">{c.image}</span>
              <span className="mono">{c.ports.join(", ") || "—"}</span>
              <span className="status-label">{c.status}</span>
              <div className="manifest-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => setLogsTarget(c)}
                >
                  Logs
                </button>
                {c.state === "running" ? (
                  <>
                    <button
                      className="btn btn-sm"
                      disabled={busyId === c.id}
                      onClick={() => runAction(c.id, "restart")}
                    >
                      Restart
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={busyId === c.id}
                      onClick={() => runAction(c.id, "stop")}
                    >
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busyId === c.id}
                    onClick={() => runAction(c.id, "start")}
                  >
                    Start
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busyId === c.id}
                  onClick={() => runAction(c.id, "remove")}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {logsTarget && (
        <LogsModal container={logsTarget} onClose={() => setLogsTarget(null)} />
      )}
    </div>
  );
}
