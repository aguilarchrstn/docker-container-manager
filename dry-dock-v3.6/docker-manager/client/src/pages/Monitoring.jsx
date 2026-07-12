import { useEffect, useRef, useState } from "react";
import { getAllContainerStats, getSystemStats } from "../api.js";
import StatBar from "../components/StatBar.jsx";
import Sparkline from "../components/Sparkline.jsx";
import LoadingState from "../components/LoadingState.jsx";
import CadvisorSettingsModal from "../components/CadvisorSettingsModal.jsx";
import GaugeDial from "../components/GaugeDial.jsx";
import { useNodeLoading } from "../lib/useNodeLoading.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { formatBytes, formatPercent } from "../lib/format.js";

const POLL_MS = 3000;
const SYSTEM_POLL_MS = 5000;
const HISTORY_LEN = 20;

export default function Monitoring() {
  const { currentId, environments, refreshEnvironments } = useEnvironment();
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useNodeLoading(loading);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemStats, setSystemStats] = useState(null);
  const history = useRef(new Map()); // id -> cpu history array
  const prevNet = useRef(new Map()); // id -> { rx, tx, time }

  const currentEnv = environments.find((e) => e.id === currentId);

  useEffect(() => {
    let cancelled = false;
    setSystemStats(null);

    async function pollSystem() {
      try {
        const result = await getSystemStats();
        if (!cancelled) setSystemStats(result);
      } catch {
        if (!cancelled) setSystemStats({ available: false, reason: "Couldn't reach this node." });
      }
    }

    pollSystem();
    const interval = setInterval(pollSystem, SYSTEM_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentId]);

  useEffect(() => {
    let cancelled = false;
    // Switching nodes means these are different containers entirely —
    // stale sparkline/rate history from the previous node would otherwise
    // bleed into the new one's first few readings.
    history.current = new Map();
    prevNet.current = new Map();
    setRows([]);
    setLoading(true);

    async function poll() {
      try {
        const { stats, source } = await getAllContainerStats();
        if (cancelled) return;
        setSource(source);

        const now = Date.now();
        const enriched = stats.map((s) => {
          const hist = history.current.get(s.id) || [];
          const nextHist = [...hist.slice(-(HISTORY_LEN - 1)), s.cpuPercent ?? 0];
          history.current.set(s.id, nextHist);

          const prev = prevNet.current.get(s.id);
          let rxRate = 0;
          let txRate = 0;
          if (prev) {
            const dt = (now - prev.time) / 1000;
            if (dt > 0) {
              rxRate = Math.max(0, (s.netRx - prev.rx) / dt);
              txRate = Math.max(0, (s.netTx - prev.tx) / dt);
            }
          }
          prevNet.current.set(s.id, { rx: s.netRx || 0, tx: s.netTx || 0, time: now });

          return { ...s, cpuHistory: nextHist, rxRate, txRate };
        });

        setRows(enriched);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentId]);

  if (showLoading) return <LoadingState label="Loading metrics…" />;

  return (
    <div>
      <div className="section-heading">
        <h2>Monitoring</h2>
        <div className="flex-row">
          <span className="status-label">Live · updates every {POLL_MS / 1000}s</span>
          {source && (
            <span className={`source-badge ${source === "cadvisor" ? "cadvisor" : ""}`}>
              {source === "cadvisor" ? "via cAdvisor" : "via Docker Engine"}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSettingsOpen(true)}>
            Metrics source
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="section-heading" style={{ marginTop: 4 }}>
        <h3 style={{ margin: 0 }}>System check</h3>
      </div>
      {systemStats == null ? (
        <div className="gauge-grid">
          <div className="gauge-unavailable field-hint">Loading system stats…</div>
        </div>
      ) : !systemStats.available ? (
        <div className="banner" style={{ marginBottom: 24 }}>{systemStats.reason}</div>
      ) : (
        <div className="gauge-grid">
          <GaugeDial label="CPU" value={systemStats.stats.cpuPercent} />
          <GaugeDial
            label="Memory"
            value={systemStats.stats.memPercent}
            sublabel={`${formatBytes(systemStats.stats.memUsed)} / ${formatBytes(systemStats.stats.memTotal)}`}
          />
          <GaugeDial
            label="Swap"
            value={systemStats.stats.swapPercent}
            sublabel={
              systemStats.stats.swapTotal
                ? `${formatBytes(systemStats.stats.swapUsed)} / ${formatBytes(systemStats.stats.swapTotal)}`
                : "No swap configured"
            }
          />
          <GaugeDial
            label="Disk"
            value={systemStats.stats.diskPercent}
            sublabel={`${formatBytes(systemStats.stats.diskUsed)} / ${formatBytes(systemStats.stats.diskTotal)}`}
          />
        </div>
      )}

      <div className="section-heading" style={{ marginTop: 8 }}>
        <h3 style={{ margin: 0 }}>Containers</h3>
      </div>

      {rows.length === 0 ? (
        <div className="manifest">
          <div className="empty-state">
            <div className="title">Nothing running right now</div>
            Start a container to see live metrics here.
          </div>
        </div>
      ) : (
        <div className="manifest">
          <div className="monitor-header">
            <span>Name</span>
            <span>CPU</span>
            <span>CPU trend</span>
            <span>Memory</span>
            <span>Network I/O</span>
            <span>Disk I/O</span>
            <span>PIDs</span>
          </div>
          {rows.map((r) => (
            <div className="monitor-row" key={r.id}>
              <span className="name">{r.name}</span>

              {r.error ? (
                <span className="status-label" style={{ gridColumn: "span 6" }}>
                  Stats unavailable
                </span>
              ) : (
                <>
                  <span>
                    <span className="mono">{formatPercent(r.cpuPercent)}</span>
                    <StatBar percent={r.cpuPercent} />
                  </span>
                  <span>
                    <Sparkline values={r.cpuHistory} width={100} height={26} max={100} />
                  </span>
                  <span>
                    <span className="mono">{formatPercent(r.memPercent)}</span>
                    <div className="status-label" style={{ marginTop: 2 }}>
                      {formatBytes(r.memUsage)} / {formatBytes(r.memLimit)}
                    </div>
                    <StatBar percent={r.memPercent} />
                  </span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    ↓ {formatBytes(r.rxRate)}/s<br />↑ {formatBytes(r.txRate)}/s
                  </span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    R {formatBytes(r.blockRead)}<br />W {formatBytes(r.blockWrite)}
                  </span>
                  <span className="mono">{r.pids}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {settingsOpen && (
        <CadvisorSettingsModal
          environment={currentEnv}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            refreshEnvironments();
          }}
        />
      )}
    </div>
  );
}
