import { useEffect, useRef, useState } from "react";
import { getAllContainerStats } from "../api.js";
import StatBar from "../components/StatBar.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { formatBytes, formatPercent } from "../lib/format.js";

const POLL_MS = 3000;
const HISTORY_LEN = 20;

export default function Monitoring() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const history = useRef(new Map()); // id -> cpu history array
  const prevNet = useRef(new Map()); // id -> { rx, tx, time }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const stats = await getAllContainerStats();
        if (cancelled) return;

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
  }, []);

  if (loading) return <p className="status-label">Loading metrics…</p>;

  return (
    <div>
      <div className="section-heading">
        <h2>Monitoring</h2>
        <span className="status-label">Live · updates every {POLL_MS / 1000}s</span>
      </div>

      {error && <div className="banner error">{error}</div>}

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
    </div>
  );
}
