const STATE_CLASS = {
  running: "running",
  exited: "exited",
  paused: "paused",
  dead: "dead",
  created: "exited",
};

export default function StatusDot({ state }) {
  const cls = STATE_CLASS[state] || "exited";
  return <span className={`led ${cls}`} title={state} />;
}
