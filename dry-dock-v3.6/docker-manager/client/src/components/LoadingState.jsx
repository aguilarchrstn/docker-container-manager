export function Spinner({ size = 16 }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 8) }}
      aria-hidden="true"
    />
  );
}

export default function LoadingState({ label = "Loading…" }) {
  return (
    <div className="loading-state">
      <Spinner size={20} />
      <span>{label}</span>
    </div>
  );
}
