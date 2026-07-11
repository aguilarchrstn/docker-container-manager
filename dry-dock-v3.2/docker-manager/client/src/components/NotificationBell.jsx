import { useEffect, useRef, useState } from "react";
import { listActivity, getAppSettings } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

const POLL_MS = 15000;

function storageKey(userId) {
  return `drydock_last_seen_activity_${userId}`;
}

export default function NotificationBell() {
  const { user, can } = useAuth();
  const canView = can(PERMISSIONS.ACTIVITY_VIEW);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [toasts, setToasts] = useState([]);
  const lastSeenRef = useRef(user ? localStorage.getItem(storageKey(user.id)) : null);
  const knownIdsRef = useRef(new Set());
  const firstPollRef = useRef(true);

  useEffect(() => {
    if (!canView) return;
    getAppSettings()
      .then((s) => setNotificationsEnabled(!!s.notificationsEnabled))
      .catch(() => {});
  }, [canView]);

  useEffect(() => {
    if (!canView || !user) return;

    async function poll() {
      try {
        const data = await listActivity({ limit: 20 });
        setEntries(data);

        // Only toast for entries we haven't seen in THIS browser session and
        // that aren't the person's own action from a moment ago (avoids
        // "toast-ing" yourself for everything you just clicked).
        if (!firstPollRef.current && notificationsEnabled) {
          const fresh = data.filter(
            (e) => !knownIdsRef.current.has(e.id) && e.actorId !== user.id
          );
          if (fresh.length > 0) {
            setToasts((prev) => [...fresh.slice(0, 3), ...prev].slice(0, 4));
            fresh.forEach((e) => {
              setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== e.id));
              }, 6000);
            });
          }
        }
        data.forEach((e) => knownIdsRef.current.add(e.id));
        firstPollRef.current = false;
      } catch {
        // quiet fail — the bell just won't update this cycle
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [canView, user, notificationsEnabled]);

  if (!canView || !user) return null;

  const unreadCount = lastSeenRef.current
    ? entries.filter((e) => e.timestamp > lastSeenRef.current).length
    : entries.length;

  function handleToggle() {
    setOpen((o) => !o);
    if (!open && entries.length > 0) {
      lastSeenRef.current = entries[0].timestamp;
      localStorage.setItem(storageKey(user.id), entries[0].timestamp);
    }
  }

  return (
    <div className="notification-bell-wrap">
      <button className="notification-bell" onClick={handleToggle} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notification-badge">{Math.min(unreadCount, 99)}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-title">Recent activity</div>
          {entries.length === 0 ? (
            <div className="field-hint" style={{ padding: "12px 14px" }}>Nothing yet.</div>
          ) : (
            entries.slice(0, 15).map((e) => (
              <div className="notification-item" key={e.id}>
                <span className="notification-item-actor">{e.actorName}</span>
                <span className="notification-item-action">{e.action}</span>
                <span className="notification-item-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="toast-host">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <strong>{t.actorName}</strong> {t.action}
          </div>
        ))}
      </div>
    </div>
  );
}
