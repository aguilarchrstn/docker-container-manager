import { useEffect, useState } from "react";
import { getDashboard } from "../api.js";
import { useEnv } from "../env/EnvContext.jsx";

export default function Dashboard() {
  const { setCurrentId } = useEnv();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await getDashboard();
        if (alive) setData(d);
      } catch (err) {
        if (alive) setError(err.message);
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (error) return <div className="empty">Failed to load dashboard: {error}</div>;
  if (!data) return <div className="empty">Loading…</div>;

  const { nodes, totals } = data;

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <StatCard label="Nodes online" value={totals.nodesOnline} accent="ok" />
        <StatCard label="Nodes offline" value={totals.nodesOffline} accent={totals.nodesOffline ? "warn" : undefined} />
        <StatCard label="Containers" value={totals.containers} sublabel={`${totals.containersRunning} running`} />
        <StatCard label="Images" value={totals.images} />
      </div>

      <h2 className="section-title">Environments</h2>
      <div className="node-grid">
        {nodes.map((n) => (
          <div key={n.id} className={`node-card ${n.ok ? "ok" : "down"}`}>
            <div className="node-head">
              <div>
                <div className="node-name">
                  {n.name} {n.isDefault && <span className="tag">default</span>}
                </div>
                <div className="node-kind">{kindLabel(n.kind)}</div>
              </div>
              <span className={`dot ${n.ok ? "green" : "red"}`} />
            </div>
            {n.ok ? (
              <>
                <div className="node-row"><span>Containers</span><b>{n.containersRunning}/{n.containers}</b></div>
                <div className="node-row"><span>Images</span><b>{n.images}</b></div>
                <div className="node-row"><span>Engine</span><b>{n.serverVersion}</b></div>
                <div className="node-row"><span>OS</span><b>{n.operatingSystem}</b></div>
              </>
            ) : (
              <div className="node-error">{n.error || "Unreachable"}</div>
            )}
            <button className="node-select" onClick={() => setCurrentId(n.id)}>Use this environment</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, accent }) {
  return (
    <div className={`stat-card ${accent || ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-sub">{sublabel}</div>}
    </div>
  );
}

function kindLabel(kind) {
  switch (kind) {
    case "local": return "Local Docker socket";
    case "tcp": return "Docker over TCP";
    case "ssh": return "Docker over SSH";
    case "remote_node": return "Remote Dry Dock node";
    default: return kind;
  }
}
