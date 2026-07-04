import { useCallback, useEffect, useState } from "react";
import { listActivity, clearActivity } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

export default function Activity() {
  const { can } = useAuth();
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading, 500);

  const refresh = useCallback(() => {
    return listActivity({ limit: 200 })
      .then((data) => {
        setEntries(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleClear() {
    if (!confirm("Clear the entire activity log? This can't be undone.")) return;
    try {
      await clearActivity();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (showLoading) return <LoadingState label="Loading activity…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Activity</h2>
        {can(PERMISSIONS.ACTIVITY_MANAGE) && (
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>Clear log</button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="title">No activity recorded yet</div>
          <div>Actions taken across Dry Dock — sign-ins, container/image/stack changes, and admin
            changes — will show up here.</div>
        </div>
      ) : (
        <div className="activity-list">
          {entries.map((e) => (
            <div className={`activity-row ${e.success === false ? "failed" : ""}`} key={e.id}>
              <span className="activity-time">{new Date(e.timestamp).toLocaleString()}</span>
              <span className="activity-actor">{e.actorName || "System"}</span>
              <span className="activity-action">{e.action}</span>
              {e.success === false && <span className="activity-fail-badge">failed</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
