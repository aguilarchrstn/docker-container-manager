import { useCallback, useEffect, useMemo, useState } from "react";
import { listImages, listContainers, removeImage, pullImage } from "../api.js";
import LoadingState from "../components/LoadingState.jsx";
import { useMinLoadingTime } from "../lib/useMinLoadingTime.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { formatBytes } from "../lib/format.js";

const PAGE_SIZES = [10, 25, 50];

function formatDate(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString();
}

export default function Images() {
  const { currentId } = useEnvironment();
  const [images, setImages] = useState([]);
  const [usedRefs, setUsedRefs] = useState(new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useMinLoadingTime(loading, 500);

  const [pullInput, setPullInput] = useState("");
  const [pullLog, setPullLog] = useState([]);
  const [pulling, setPulling] = useState(false);

  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("created");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    return Promise.all([listImages(), listContainers()])
      .then(([imgs, containers]) => {
        setImages(imgs);
        setUsedRefs(new Set(containers.map((c) => c.image)));
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    setPage(1);
    refresh().finally(() => setLoading(false));
  }, [refresh, currentId]);

  function isUnused(img) {
    if (usedRefs.has(img.id) || usedRefs.has(img.shortId)) return false;
    return !img.tags.some((t) => usedRefs.has(t));
  }

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

  async function handleRemoveOne(id) {
    if (!confirm("Remove this image?")) return;
    setBusy(true);
    try {
      await removeImage(id, true);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} image(s)?`)) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await removeImage(id, true);
      }
      setSelected(new Set());
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = images;
    if (q) {
      list = list.filter(
        (img) =>
          img.shortId.toLowerCase().includes(q) ||
          img.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === "tags") {
        av = (a.tags[0] || "").toLowerCase();
        bv = (b.tags[0] || "").toLowerCase();
      } else {
        av = a[sortKey] ?? 0;
        bv = b[sortKey] ?? 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [images, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const pageIds = pageItems.map((i) => i.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function sortArrow(key) {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  if (showLoading) return <LoadingState label="Loading images…" />;

  return (
    <div>
      <div className="pull-card">
        <div className="pull-card-title">
          <span className="pull-card-icon">⬇</span> Pull image
        </div>
        <form onSubmit={handlePull} className="pull-form">
          <label className="form-label" style={{ flex: 1 }}>
            Image
            <div className="pull-input-group">
              <span className="pull-input-prefix">docker.io /</span>
              <input
                type="text"
                className="form-input mono"
                placeholder="e.g. nginx:latest"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                disabled={pulling}
              />
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={pulling || !pullInput.trim()}>
            {pulling ? "Pulling…" : "Pull the image"}
          </button>
        </form>
        {pullLog.length > 0 && (
          <pre className="logs-body pull-log">{pullLog.join("\n")}</pre>
        )}
      </div>

      <div className="section-heading" style={{ marginTop: 24 }}>
        <h2>Images</h2>
        <button className="btn btn-sm btn-ghost" onClick={refresh}>Refresh</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="table-toolbar">
        <input
          className="form-input table-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <span className="spacer" />
        <button
          className="btn btn-sm btn-danger"
          disabled={selected.size === 0 || busy}
          onClick={handleRemoveSelected}
        >
          Remove {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
      </div>

      {images.length === 0 ? (
        <div className="empty-state">
          <div className="title">No images yet</div>
          Pull one above to get started.
        </div>
      ) : (
        <>
          <div className="data-table">
            <div className="data-table-header">
              <span className="data-table-checkbox">
                <input
                  type="checkbox"
                  checked={pageItems.length > 0 && pageItems.every((i) => selected.has(i.id))}
                  onChange={toggleAllOnPage}
                />
              </span>
              <button className="data-table-sort" onClick={() => toggleSort("shortId")}>Id {sortArrow("shortId")}</button>
              <button className="data-table-sort" onClick={() => toggleSort("tags")}>Tags {sortArrow("tags")}</button>
              <button className="data-table-sort" onClick={() => toggleSort("size")}>Size {sortArrow("size")}</button>
              <button className="data-table-sort" onClick={() => toggleSort("created")}>Created {sortArrow("created")}</button>
              <span></span>
            </div>
            {pageItems.map((img) => (
              <div className="data-table-row" key={img.id}>
                <span className="data-table-checkbox">
                  <input type="checkbox" checked={selected.has(img.id)} onChange={() => toggleOne(img.id)} />
                </span>
                <span className="mono">
                  {img.shortId}
                  {isUnused(img) && <span className="unused-badge">Unused</span>}
                </span>
                <span className="tag-pills">
                  {img.tags.length ? (
                    img.tags.map((t) => <span className="tag-pill" key={t}>{t}</span>)
                  ) : (
                    <span className="mono">&lt;none&gt;</span>
                  )}
                </span>
                <span className="status-label">{formatBytes(img.size)}</span>
                <span className="field-hint">{formatDate(img.created)}</span>
                <span className="data-table-actions">
                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => handleRemoveOne(img.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="table-pagination">
            <label className="field-hint">
              Items per page{" "}
              <select
                className="form-input"
                style={{ display: "inline-block", width: "auto", marginLeft: 6 }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="field-hint">{page} / {totalPages}</span>
            <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </>
      )}
    </div>
  );
}
