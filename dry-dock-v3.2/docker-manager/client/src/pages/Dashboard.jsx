import { useCallback, useEffect, useState } from "react";
import { getDashboard, deleteEnvironment } from "../api.js";
import EnvironmentWizard from "../components/EnvironmentWizard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const TYPE_LABELS = {
  local: "Local socket",
  standalone: "Standalone node",
  agent: "Self-hosted manager",
};

export default function Dashboard({ onSwitchEnvironment }) {
  const { can } = useAuth();
  const { selectEnvironment, refreshEnvironments } = useEnvironment();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(() => {
    return getDashboard()
      .then((data) => {
        setCards(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleRemove(id, name) {
    if (!confirm(`Remove environment "${name}"? Dry Dock will stop tracking it.`)) return;
    try {
      await deleteEnvironment(id);
      refresh();
      refreshEnvironments();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleManage(id) {
    selectEnvironment(id);
    onSwitchEnvironment("containers");
  }

  const canManage = can(PERMISSIONS.ENVIRONMENTS_MANAGE);

  return (
    <div>
      <div className="section-heading">
        <h2>Environments</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setWizardOpen(true)}>
            + Add environment
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}
      {showLoading ? (
        <LoadingState label="Loading environments…" />
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <div className="title">No environments yet</div>
          <div>Add one to start managing containers on another node.</div>
        </div>
      ) : (
        <div className="env-card-grid">
          {cards.map((card) => (
            <div className="env-card" key={card.id}>
              <div className="env-card-top">
                <span className={`led ${card.online ? "running" : "dead"}`} />
                <div className="env-card-name">{card.name}</div>
                {!card.id.startsWith("local") && canManage && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRemove(card.id, card.name)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="env-card-type">{TYPE_LABELS[card.type] || card.type}</div>
              {card.description && <div className="field-hint">{card.description}</div>}

              {card.online ? (
                <div className="stat-grid" style={{ marginTop: 12 }}>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Containers</div>
                    <div className="stat-tile-value">
                      {card.info?.containersRunning ?? "—"}
                      <span className="stat-tile-sub"> / {card.info?.containers ?? "—"}</span>
                    </div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Images</div>
                    <div className="stat-tile-value">{card.info?.images ?? "—"}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-tile-label">CPUs</div>
                    <div className="stat-tile-value">{card.info?.ncpu ?? "—"}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Memory</div>
                    <div className="stat-tile-value">{formatBytes(card.info?.memTotal)}</div>
                  </div>
                </div>
              ) : (
                <div className="banner error" style={{ marginTop: 12 }}>
                  {card.error || "Offline"}
                </div>
              )}

              {card.online && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => handleManage(card.id)}
                >
                  Manage this node →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {wizardOpen && (
        <EnvironmentWizard
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            refresh();
            refreshEnvironments();
          }}
        />
      )}
    </div>
  );
}
