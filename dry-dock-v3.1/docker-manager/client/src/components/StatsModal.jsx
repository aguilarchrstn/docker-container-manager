import { useEffect, useRef, useState } from "react";
import { getContainerStats } from "../api.js";
import StatBar from "./StatBar.jsx";
import Sparkline from "./Sparkline.jsx";
import { formatBytes, formatPercent } from "../lib/format.js";

const POLL_MS = 2000;
const HISTORY_LEN = 30;

export default function StatsModal({ container, onClose }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const prevNet = useRef(null);
  const [netRate, setNetRate] = useState({ rx: 0, tx: 0 });

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const s = await getContainerStats(container.id);
        if (cancelled) return;
        setStats(s);
        setError(null);
        setCpuHistory((h) => [...h.slice(-(HISTORY_LEN - 1)), s.cpuPercent]);

        const now = Date.now();
        if (prevNet.current) {
          const dt = (now - prevNet.current.time) / 1000;
          if (dt > 0) {
            setNetRate({
              rx: Math.max(0, (s.netRx - prevNet.current.rx) / dt),
              tx: Math.max(0, (s.netTx - prevNet.current.tx) / dt),
            });
          }
        }
        prevNet.current = { rx: s.netRx, tx: s.netTx, time: now };
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [container.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(520px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{container.name} — stats</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="form-body">
          {error && <div className="banner error">{error}</div>}

          {!stats && !error && <p className="status-label">Loading stats…</p>}

          {stats && (
            <>
              <div className="stat-block">
                <div className="stat-block-header">
                  <span>CPU</span>
                  <span className="mono">{formatPercent(stats.cpuPercent)}</span>
                </div>
                <StatBar percent={stats.cpuPercent} />
                <div style={{ marginTop: 10 }}>
                  <Sparkline values={cpuHistory} max={100} />
                </div>
              </div>

              <div className="stat-block">
                <div className="stat-block-header">
                  <span>Memory</span>
                  <span className="mono">
                    {formatBytes(stats.memUsage)} / {formatBytes(stats.memLimit)}
                  </span>
                </div>
                <StatBar percent={stats.memPercent} />
              </div>

              <div className="stat-grid">
                <div className="stat-tile">
                  <div className="stat-tile-label">Network RX</div>
                  <div className="stat-tile-value mono">{formatBytes(netRate.rx)}/s</div>
                  <div className="stat-tile-sub mono">{formatBytes(stats.netRx)} total</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">Network TX</div>
                  <div className="stat-tile-value mono">{formatBytes(netRate.tx)}/s</div>
                  <div className="stat-tile-sub mono">{formatBytes(stats.netTx)} total</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">Block read</div>
                  <div className="stat-tile-value mono">{formatBytes(stats.blockRead)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">Block write</div>
                  <div className="stat-tile-value mono">{formatBytes(stats.blockWrite)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">Processes</div>
                  <div className="stat-tile-value mono">{stats.pids}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
