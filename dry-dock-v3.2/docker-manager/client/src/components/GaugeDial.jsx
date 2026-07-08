// A semi-circular gauge: value 0-100 maps to a needle angle from -90deg
// (empty, far left) to +90deg (full, far right). Color follows the same
// success/warning/danger thresholds used elsewhere in the app, rather
// than a fixed color, so a gauge reading in the red is visually obvious
// at a glance.
function zoneColor(value) {
  if (value >= 85) return "var(--color-danger)";
  if (value >= 65) return "var(--color-warning)";
  return "var(--color-success)";
}

export default function GaugeDial({ label, value, sublabel }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const angle = -90 + (clamped / 100) * 180;
  const color = zoneColor(clamped);

  // Arc geometry: a half-circle from -90deg to +90deg, radius 42, drawn
  // with three colored segments (green/orange/red zones) as the track,
  // then the needle on top.
  const cx = 50;
  const cy = 54;
  const r = 42;

  function pointOnArc(deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  }

  const needleTip = pointOnArc(angle);

  return (
    <div className="gauge-dial">
      <svg viewBox="0 0 100 66" className="gauge-svg">
        <path
          d={`M ${pointOnArc(-90).x} ${pointOnArc(-90).y} A ${r} ${r} 0 0 1 ${pointOnArc(90).x} ${pointOnArc(90).y}`}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M ${pointOnArc(-90).x} ${pointOnArc(-90).y} A ${r} ${r} 0 0 1 ${pointOnArc(angle).x} ${pointOnArc(angle).y}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="var(--color-text)" />
      </svg>
      <div className="gauge-value" style={{ color }}>{Math.round(clamped)}%</div>
      <div className="gauge-label">{label}</div>
      {sublabel && <div className="gauge-sublabel">{sublabel}</div>}
    </div>
  );
}
