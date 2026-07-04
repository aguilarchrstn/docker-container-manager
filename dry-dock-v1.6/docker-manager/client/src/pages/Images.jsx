import { useCallback, useEffect, useState } from "react";
import { listImages, removeImage, pullImage } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";

function formatSize(bytes) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function Images() {
  const { currentId } = useEnvironment();
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading, 500);
  const [pullInput, setPullInput] = useState("");
  const [pullLog, setPullLog] = useState([]);
  const [pulling, setPulling] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(() => {
    return listImages()
      .then((data) => {
        setImages(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, currentId]);

  async function handlePull(e) {
    e.preventDefault();
    if (!pullInput.trim()) return;
    setPulling(true);
    setPullLog([]);
    try {
      await pullImage(pullInput.trim(), (event) => {
        setPullLog((log) => {
          const line = event.status
            ? `${event.status}${event.progress ? " " + event.progress : ""}`
            : event.error
              ? `Error: ${event.error}`
              : JSON.stringify(event);
          return [...log.slice(-40), line];
        });
      });
      setPullInput("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPulling(false);
    }
  }

  async function handleRemove(id) {
    if (!confirm("Remove this image?")) return;
    setBusyId(id);
    try {
      await removeImage(id, true);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <h2>Images</h2>
        <button className="btn btn-sm" onClick={refresh}>Refresh</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <form onSubmit={handlePull} style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          type="text"
          placeholder="e.g. nginx:latest"
          value={pullInput}
          onChange={(e) => setPullInput(e.target.value)}
          disabled={pulling}
          style={{
            flex: 1,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={pulling}>
          {pulling ? "Pulling…" : "Pull image"}
        </button>
      </form>

      {pullLog.length > 0 && (
        <pre
          className="logs-body"
          style={{ marginBottom: 18, maxHeight: 160, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
        >
          {pullLog.join("\n")}
        </pre>
      )}

      {showLoading ? (
        <LoadingState label="Loading images…" />
      ) : images.length === 0 ? (
        <div className="manifest">
          <div className="empty-state">
            <div className="title">No images yet</div>
            Pull one above to get started.
          </div>
        </div>
      ) : (
        <div className="manifest">
          <div className="manifest-header" style={{ gridTemplateColumns: "1.8fr 1fr 100px auto" }}>
            <span>Repository : Tag</span>
            <span>Image ID</span>
            <span>Size</span>
            <span></span>
          </div>
          {images.map((img) => (
            <div
              className="manifest-row"
              style={{ gridTemplateColumns: "1.8fr 1fr 100px auto" }}
              key={img.id}
            >
              <span className="name">
                {img.tags.length ? img.tags.join(", ") : <span className="mono">&lt;none&gt;</span>}
              </span>
              <span className="mono">{img.shortId}</span>
              <span className="status-label">{formatSize(img.size)}</span>
              <div className="manifest-actions">
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busyId === img.id}
                  onClick={() => handleRemove(img.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
