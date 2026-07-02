import { useState } from "react";
import { createContainer } from "../api.js";

const RESTART_POLICIES = [
  { value: "no", label: "No" },
  { value: "unless-stopped", label: "Unless stopped" },
  { value: "always", label: "Always" },
  { value: "on-failure", label: "On failure" },
];

function emptyPort() { return { host: "", container: "", protocol: "tcp" }; }
function emptyEnv() { return { key: "", value: "" }; }

export default function CreateContainerModal({ onClose, onCreated }) {
  const [image, setImage] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [restartPolicy, setRestartPolicy] = useState("no");
  const [startAfter, setStartAfter] = useState(true);
  const [ports, setPorts] = useState([emptyPort()]);
  const [env, setEnv] = useState([emptyEnv()]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function updatePort(i, field, value) {
    setPorts((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function updateEnv(i, field, value) {
    setEnv((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!image.trim()) {
      setError("Image is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createContainer({
        image: image.trim(),
        name: name.trim() || undefined,
        command: command.trim() || undefined,
        restartPolicy,
        start: startAfter,
        ports: ports.filter((p) => p.container.trim()),
        env: env.filter((e) => e.key.trim()),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add container</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="form-body">
          {error && <div className="banner error">{error}</div>}

          <label className="form-label">
            Image *
            <input
              className="form-input mono"
              placeholder="e.g. nginx:latest"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              autoFocus
            />
          </label>

          <label className="form-label">
            Container name
            <input
              className="form-input"
              placeholder="optional"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="form-label">
            Command
            <input
              className="form-input mono"
              placeholder="optional, e.g. nginx -g 'daemon off;'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </label>

          <div className="form-section">
            <div className="form-section-title">
              Ports
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPorts((r) => [...r, emptyPort()])}>
                + Add port
              </button>
            </div>
            {ports.map((p, i) => (
              <div className="form-row" key={i}>
                <input
                  className="form-input mono"
                  placeholder="Host port"
                  value={p.host}
                  onChange={(e) => updatePort(i, "host", e.target.value)}
                />
                <span className="form-row-sep">:</span>
                <input
                  className="form-input mono"
                  placeholder="Container port"
                  value={p.container}
                  onChange={(e) => updatePort(i, "container", e.target.value)}
                />
                <select
                  className="form-input"
                  value={p.protocol}
                  onChange={(e) => updatePort(i, "protocol", e.target.value)}
                >
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setPorts((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="form-section">
            <div className="form-section-title">
              Environment variables
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEnv((r) => [...r, emptyEnv()])}>
                + Add variable
              </button>
            </div>
            {env.map((row, i) => (
              <div className="form-row" key={i}>
                <input
                  className="form-input mono"
                  placeholder="KEY"
                  value={row.key}
                  onChange={(e) => updateEnv(i, "key", e.target.value)}
                />
                <span className="form-row-sep">=</span>
                <input
                  className="form-input mono"
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateEnv(i, "value", e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setEnv((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <label className="form-label">
            Restart policy
            <select
              className="form-input"
              value={restartPolicy}
              onChange={(e) => setRestartPolicy(e.target.value)}
            >
              {RESTART_POLICIES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={startAfter}
              onChange={(e) => setStartAfter(e.target.checked)}
            />
            Start container after creating
          </label>

          <div className="save-bar">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create container"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
