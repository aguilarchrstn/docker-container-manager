/**
 * ContainerMetricsChart — a Grafana-style SVG chart panel.
 *
 * Props:
 *   title      {string}   Panel header label
 *   series     {Array}    [{ label, color, values: number[], fill?: bool }]
 *   yLabel     {string?}  Y-axis unit suffix (e.g. "%" or "MB/s")
 *   yMax       {number?}  Force a fixed Y ceiling (auto-scales when omitted)
 *   yFormatter {fn?}      Custom value → display string
 *   height     {number?}  Chart height in px (default 140)
 *   type       {"line"|"bar"}  Default "line"
 */
export default function ContainerMetricsChart({
  title,
  series = [],
  yLabel = "",
  yMax,
  yFormatter,
  height = 140,
  type = "line",
}) {
  const W = 600;   // internal SVG viewBox width
  const H = height;
  const PAD = { top: 10, right: 12, bottom: 30, left: 46 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // ── Compute Y domain ─────────────────────────────────────────────────
  const allValues = series.flatMap((s) => s.values ?? []);
  const dataMax = allValues.length ? Math.max(...allValues) : 1;
  const ceiling = yMax != null ? yMax : dataMax <= 0 ? 1 : dataMax * 1.15;

  // nice Y ticks (4-5 steps)
  function niceTicks(max, steps = 4) {
    if (max <= 0) return [0];
    const raw = max / steps;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 2.5, 5, 10].find((n) => n * mag >= raw) ?? 10;
    const step = nice * mag;
    const ticks = [];
    for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(parseFloat(v.toFixed(10)));
    return ticks;
  }
  const yTicks = niceTicks(ceiling);

  // ── Coordinate helpers ────────────────────────────────────────────────
  function toX(i, total) {
    if (total <= 1) return PAD.left + innerW;
    return PAD.left + (i / (total - 1)) * innerW;
  }

  function toY(v) {
    return PAD.top + innerH - (Math.max(0, Math.min(ceiling, v)) / ceiling) * innerH;
  }

  // ── Render each series ────────────────────────────────────────────────
  function renderLine(s, si) {
    const vals = s.values ?? [];
    if (vals.length < 2) return null;
    const pts = vals.map((v, i) => [toX(i, vals.length), toY(v)]);
    const linePath = "M " + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ");

    let fillPath = "";
    if (s.fill !== false) {
      const base = PAD.top + innerH;
      fillPath =
        linePath +
        ` L ${pts[pts.length - 1][0].toFixed(2)},${base} L ${pts[0][0].toFixed(2)},${base} Z`;
    }

    return (
      <g key={si}>
        {fillPath && (
          <path
            d={fillPath}
            fill={s.color}
            opacity={0.12}
          />
        )}
        <path
          d={linePath}
          fill="none"
          stroke={s.color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* current value dot */}
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r="2.8"
          fill={s.color}
        />
      </g>
    );
  }

  function renderBar(s, si, totalSeries) {
    const vals = s.values ?? [];
    if (!vals.length) return null;
    const totalBars = vals.length;
    const slotW = innerW / Math.max(totalBars, 1);
    const barW = Math.max(2, slotW / totalSeries - 2);

    return (
      <g key={si}>
        {vals.map((v, i) => {
          const barH = (Math.max(0, Math.min(ceiling, v)) / ceiling) * innerH;
          const x =
            PAD.left +
            (i / totalBars) * innerW +
            slotW * 0.1 +
            si * (barW + 1);
          const y = PAD.top + innerH - barH;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={s.color}
              opacity={0.85}
              rx="1"
            />
          );
        })}
      </g>
    );
  }

  // ── X tick labels (show first, mid, last timestamp index labels) ──────
  const sampleVals = series[0]?.values ?? [];
  const totalPts = sampleVals.length;
  const xTickIndices =
    totalPts <= 1
      ? [0]
      : [0, Math.floor(totalPts / 4), Math.floor(totalPts / 2), Math.floor((3 * totalPts) / 4), totalPts - 1].filter(
          (v, i, arr) => arr.indexOf(v) === i
        );

  const fmt = yFormatter ?? ((v) => {
    if (ceiling >= 1e9) return (v / 1e9).toFixed(1) + "G";
    if (ceiling >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (ceiling >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
  });

  return (
    <div className="grafana-panel">
      <div className="grafana-panel-header">
        <span className="grafana-panel-title">{title}</span>
        {/* Legend */}
        <span className="grafana-legend">
          {series.map((s, i) => (
            <span key={i} className="grafana-legend-item">
              <span className="grafana-legend-dot" style={{ background: s.color }} />
              {s.label}
              {s.values?.length > 0 && (
                <span className="grafana-legend-val" style={{ color: s.color }}>
                  {fmt(s.values[s.values.length - 1])}{yLabel}
                </span>
              )}
            </span>
          ))}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="grafana-svg"
        aria-label={title}
        role="img"
      >
        {/* ── Grid lines ── */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + innerW}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="9"
                fill="rgba(255,255,255,0.35)"
              >
                {fmt(tick)}{yLabel}
              </text>
            </g>
          );
        })}

        {/* ── X tick labels ── */}
        {xTickIndices.map((idx) => {
          const x = toX(idx, totalPts);
          const label = `t-${(totalPts - 1 - idx) * 3}s`;
          return (
            <text
              key={idx}
              x={x}
              y={PAD.top + innerH + 18}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(255,255,255,0.3)"
            >
              {idx === totalPts - 1 ? "now" : label}
            </text>
          );
        })}

        {/* ── Chart border box ── */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />

        {/* ── Series ── */}
        {type === "bar"
          ? series.map((s, si) => renderBar(s, si, series.length))
          : series.map((s, si) => renderLine(s, si))}
      </svg>
    </div>
  );
}
