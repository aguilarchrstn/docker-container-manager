import { useEffect, useRef, useState } from "react";
import { getContainerLogs } from "../api.js";

export default function LogsModal({ container, onClose }) {
  const [logs, setLogs] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const bodyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getContainerLogs(container.id)
      .then((text) => {
        if (cancelled) return;
        setLogs(text || "(no output yet)");
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [container.id]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{container.name} — logs</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {error ? (
          <div className="banner error" style={{ margin: 16 }}>{error}</div>
        ) : (
          <pre className="logs-body" ref={bodyRef}>
            {loading ? "Loading logs…" : logs}
          </pre>
        )}
      </div>
    </div>
  );
}
