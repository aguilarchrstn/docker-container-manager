export default function StatBar({ percent = 0 }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color =
    clamped > 90 ? "var(--color-danger)" : clamped > 70 ? "var(--color-warning)" : "var(--color-primary)";

  return (
    <div className="stat-bar-track">
      <div
        className="stat-bar-fill"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
