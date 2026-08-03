import { useEffect, useRef, useState, useCallback } from "react";
import { getAllContainerStats, getSystemStats } from "../api.js";
import StatBar from "../components/StatBar.jsx";
import Sparkline from "../components/Sparkline.jsx";
import LoadingState from "../components/LoadingState.jsx";
import GaugeDial from "../components/GaugeDial.jsx";
import ContainerMetricsChart from "../components/ContainerMetricsChart.jsx";
import { useNodeLoading } from "../lib/useNodeLoading.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { formatBytes, formatPercent } from "../lib/format.js";

const POLL_MS = 3000;
const SYSTEM_POLL_MS = 5000;
const HISTORY_LEN = 20;

const COLUMNS = [
  { key: "name",       label: "Name",        sortable: true  },
  { key: "cpuPercent", label: "CPU",         sortable: true  },
  { key: "cpu-trend",  label: "CPU Trend",   sortable: false },
  { key: "memPercent", label: "Memory",      sortable: true  },
  { key: "netRx",      label: "Network I/O", sortable: true  },
  { key: "blockRead",  label: "Disk I/O",    sortable: true  },
  { key: "pids",       label: "PIDs",        sortable: true  },
];

function SortIcon({ dir }) {
  return (
    <span className="sort-icon" aria-hidden="true">
      {dir === "asc" ? "↑" : dir === "desc" ? "↓" : "⇅"}
    </span>
  );
}

export default function Monitoring() {
  const { currentId } = useEnvironment();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useNodeLoading(loading);
  const [systemStats, setSystemStats] = useState(null);
  const [chartHistory, setChartHistory] = useState({
    cpuMax: [],
    cpuMin: [],
    cpuAvg: [],
    memMax: [],
    memMin: [],
    memAvg: [],
    rxRate: [],
    txRate: [],
    readRate: [],
    writeRate: [],
  });
  const [sortKey, setSortKey] = useState("cpuPercent");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(new Set());

  const history = useRef(new Map());
  const prevNet = useRef(new Map());
  const prevIO = useRef(new Map());

  // ── System stats poll ──────────────────────────────────────────────
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
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentId]);

  // ── Container stats poll ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    history.current = new Map();
    prevNet.current = new Map();
    prevIO.current = new Map();
    setRows([]);
    setSelected(new Set());
    setChartHistory({
      cpuMax: [],
      cpuMin: [],
      cpuAvg: [],
      memMax: [],
      memMin: [],
      memAvg: [],
      rxRate: [],
      txRate: [],
      readRate: [],
      writeRate: [],
    });
    setLoading(true);

    async function poll() {
      try {
        const { stats } = await getAllContainerStats();
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

          const prevIOEntry = prevIO.current.get(s.id);
          let readRate = 0;
          let writeRate = 0;
          if (prevIOEntry) {
            const dt = (now - prevIOEntry.time) / 1000;
            if (dt > 0) {
              readRate = Math.max(0, (s.blockRead - prevIOEntry.read) / dt);
              writeRate = Math.max(0, (s.blockWrite - prevIOEntry.write) / dt);
            }
          }
          prevIO.current.set(s.id, { read: s.blockRead || 0, write: s.blockWrite || 0, time: now });

          return { ...s, cpuHistory: nextHist, rxRate, txRate, readRate, writeRate };
        });

        setRows(enriched);

        const valid = enriched.filter((row) => !row.error);
        const statsValues = {
          cpu: valid.map((row) => row.cpuPercent ?? 0),
          mem: valid.map((row) => row.memPercent ?? 0),
          rx: valid.map((row) => row.rxRate ?? 0),
          tx: valid.map((row) => row.txRate ?? 0),
          read: valid.map((row) => row.readRate ?? 0),
          write: valid.map((row) => row.writeRate ?? 0),
        };

        const summarize = (values) => {
          if (values.length === 0) return { max: 0, min: 0, avg: 0 };
          const max = Math.max(...values);
          const min = Math.min(...values);
          const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
          return { max, min, avg };
        };

        const cpuStats = summarize(statsValues.cpu);
        const memStats = summarize(statsValues.mem);

        setChartHistory((prev) => {
          const push = (values, nextValue) => {
            const next = [...values, nextValue];
            return next.length > HISTORY_LEN ? next.slice(next.length - HISTORY_LEN) : next;
          };

          return {
            cpuMax: push(prev.cpuMax, cpuStats.max),
            cpuMin: push(prev.cpuMin, cpuStats.min),
            cpuAvg: push(prev.cpuAvg, cpuStats.avg),
            memMax: push(prev.memMax, memStats.max),
            memMin: push(prev.memMin, memStats.min),
            memAvg: push(prev.memAvg, memStats.avg),
            rxRate: push(prev.rxRate, summarize(statsValues.rx).avg),
            txRate: push(prev.txRate, summarize(statsValues.tx).avg),
            readRate: push(prev.readRate, summarize(statsValues.read).avg),
            writeRate: push(prev.writeRate, summarize(statsValues.write).avg),
          };
        });

        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentId]);

  // ── Sort ───────────────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const sortedRows = [...rows].sort((a, b) => {
    if (sortKey === "name") {
      const cmp = (a.name || "").localeCompare(b.name || "");
      return sortDir === "asc" ? cmp : -cmp;
    }
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  // ── Selection ──────────────────────────────────────────────────────
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (showLoading) return <LoadingState label="Loading metrics…" />;

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-heading">
        <h2>Monitoring</h2>
        <span className="status-label">
          Live · updates every {POLL_MS / 1000}s
        </span>
      </div>

      {error && <div className="banner error">{error}</div>}

      {/* ── System check gauges ── */}
      <div className="section-heading" style={{ marginTop: 4 }}>
        <h3 style={{ margin: 0 }}>System</h3>
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

      {/* ── Overview charts ── */}
      <div className="section-heading" style={{ marginTop: 8 }}>
       <h3 style={{ margin: 0 }}>Metrics</h3>
      </div>

      <div className="monitoring-grid">
       <ContainerMetricsChart
         title="CPU usage"
         series={[
           { label: "Max", color: "#f27c49", values: chartHistory.cpuMax, fill: false },
           { label: "Avg", color: "#6fc2ff", values: chartHistory.cpuAvg, fill: false },
           { label: "Min", color: "#8bd17f", values: chartHistory.cpuMin, fill: false },
         ]}
         yLabel="%"
         yMax={100}
         height={220}
       />

       <ContainerMetricsChart
         title="Memory usage"
         series={[
           { label: "Max", color: "#f27c49", values: chartHistory.memMax, fill: false },
           { label: "Avg", color: "#6fc2ff", values: chartHistory.memAvg, fill: false },
           { label: "Min", color: "#8bd17f", values: chartHistory.memMin, fill: false },
         ]}
         yLabel="%"
         yMax={100}
         height={220}
       />

       <ContainerMetricsChart
         title="Network traffic"
         series={[
           { label: "Receive", color: "#6fc2ff", values: chartHistory.rxRate, fill: false },
           { label: "Transmit", color: "#8bd17f", values: chartHistory.txRate, fill: false },
         ]}
         yLabel="B/s"
         height={220}
       />

       <ContainerMetricsChart
         title="Disk I/O"
         type="bar"
         series={[
           { label: "Read", color: "#6fc2ff", values: chartHistory.readRate },
           { label: "Write", color: "#8bd17f", values: chartHistory.writeRate },
         ]}
         yLabel="B/s"
         height={220}
       />
      </div>

      {/* ── Container metrics table ── */}
      <div className="section-heading" style={{ marginTop: 8 }}>
       <h3 style={{ margin: 0 }}>Containers</h3>
        {selected.size > 0 && (
          <span className="metrics-selection-count">
            {selected.size} selected
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="metrics-table">
          <div className="empty-state">
            <div className="title">Nothing running right now</div>
            Start a container to see live metrics here.
          </div>
        </div>
      ) : (
        <div className="metrics-table">
          {/* Header */}
          <div className="metrics-header">
            {/* Select-all checkbox */}
            <span className="metrics-check-cell">
              <input
                type="checkbox"
                className="row-checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                aria-label="Select all containers"
              />
            </span>
            {COLUMNS.map((col) => (
              <span
                key={col.key}
                className={`metrics-col-header ${col.sortable ? "sortable" : ""} ${sortKey === col.key ? "active" : ""}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                role={col.sortable ? "button" : undefined}
                tabIndex={col.sortable ? 0 : undefined}
                onKeyDown={col.sortable ? (e) => e.key === "Enter" && handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                )}
              </span>
            ))}
          </div>

          {/* Rows */}
          {sortedRows.map((r) => (
            <div
              className={`metrics-row ${selected.has(r.id) ? "selected" : ""}`}
              key={r.id}
              onClick={() => toggleRow(r.id)}
            >
              {/* Checkbox */}
              <span
                className="metrics-check-cell"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="row-checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleRow(r.id)}
                  aria-label={`Select ${r.name}`}
                />
              </span>

              {/* Name */}
              <span className="metrics-name" title={r.name}>{r.name}</span>

              {r.error ? (
                <span className="status-label metrics-unavailable">
                  Stats unavailable
                </span>
              ) : (
                <>
                  {/* CPU % + bar */}
                  <span className="metrics-cpu-cell">
                    <span className="metrics-value">{formatPercent(r.cpuPercent)}</span>
                    <StatBar percent={r.cpuPercent} />
                  </span>

                  {/* CPU trend sparkline */}
                  <span className="metrics-sparkline-cell">
                    <Sparkline values={r.cpuHistory} width={100} height={26} max={100} />
                  </span>

                  {/* Memory % + usage/limit + bar */}
                  <span className="metrics-mem-cell">
                    <span className="metrics-value">{formatPercent(r.memPercent)}</span>
                    <span className="metrics-sub">
                      {formatBytes(r.memUsage)} / {formatBytes(r.memLimit)}
                    </span>
                    <StatBar percent={r.memPercent} />
                  </span>

                  {/* Network I/O */}
                  <span className="metrics-io-cell">
                    <span className="metrics-io-row">
                      <span className="metrics-io-arrow down">↓</span>
                      <span className="metrics-value">{formatBytes(r.rxRate)}/s</span>
                    </span>
                    <span className="metrics-io-row">
                      <span className="metrics-io-arrow up">↑</span>
                      <span className="metrics-value">{formatBytes(r.txRate)}/s</span>
                    </span>
                  </span>

                  {/* Disk I/O */}
                  <span className="metrics-io-cell">
                    <span className="metrics-io-row">
                      <span className="metrics-io-label">R</span>
                      <span className="metrics-value">{formatBytes(r.blockRead)}</span>
                    </span>
                    <span className="metrics-io-row">
                      <span className="metrics-io-label">W</span>
                      <span className="metrics-value">{formatBytes(r.blockWrite)}</span>
                    </span>
                  </span>

                  {/* PIDs */}
                  <span className="metrics-pids-cell">
                    <span className="metrics-value mono">{r.pids}</span>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
