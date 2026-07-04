export default function Sparkline({ values = [], width = 120, height = 32, max = 100 }) {
  if (values.length < 2) {
    return <svg width={width} height={height} className="sparkline" />;
  }

  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (Math.max(0, Math.min(max, v)) / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const lastY = height - (Math.max(0, Math.min(max, last)) / max) * height;

  return (
    <svg width={width} height={height} className="sparkline" viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
      <circle cx={width} cy={lastY} r="2" fill="var(--color-primary)" />
    </svg>
  );
}
