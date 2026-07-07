import { useEffect, useRef, useState } from "react";
import { getContainerLogs, getContainerLogsStreamUrl } from "../api.js";

export default function LogsModal({ container, onClose }) {
  const [logs, setLogs] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const bodyRef = useRef(null);
  const sourceRef = useRef(null);

  // Static tail — the default view, and what "Follow" falls back to if the
  // live stream errors out or is turned off.
  useEffect(() => {
    if (following) return;
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
  }, [container.id, following]);

  // Live tail over Server-Sent Events.
  useEffect(() => {
    if (!following) return;
    setError(null);
    setLogs("");
    const url = getContainerLogsStreamUrl(container.id, 100);
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (event) => {
      setLogs((prev) => (prev ? prev + "\n" + event.data : event.data));
    };
    source.addEventListener("error", () => {
      setError("Live stream disconnected — showing the static tail instead.");
      setFollowing(false);
    });
    source.addEventListener("end", () => {
      source.close();
    });

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [container.id, following]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{container.name} — logs</h2>
          <div className="flex-row">
            <label className="form-checkbox" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={following} onChange={(e) => setFollowing(e.target.checked)} />
              Follow
              {following && <span className="live-dot" />}
            </label>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        {error && <div className="banner error" style={{ margin: "0 16px 16px" }}>{error}</div>}
        <pre className="logs-body" ref={bodyRef}>
          {loading && !following ? "Loading logs…" : logs || "(no output yet)"}
        </pre>
      </div>
    </div>
  );
}
