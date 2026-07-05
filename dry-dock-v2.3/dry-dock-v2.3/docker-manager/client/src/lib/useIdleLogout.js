import { useEffect, useRef } from "react";
import { getAppSettings } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

// Logs the user out after `autoLogoutMinutes` of no mouse/keyboard/scroll
// activity (0 = disabled). Checked against real wall-clock time via a
// timestamp, not a naive setTimeout that resets on every event — so a
// throttled background tab still gets logged out at the right time rather
// than never (setTimeout can get deprioritized in inactive tabs).
export function useIdleLogout() {
  const { user, logout } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const limitMsRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getAppSettings()
      .then((s) => {
        if (!cancelled) limitMsRef.current = (s.autoLogoutMinutes || 0) * 60 * 1000;
      })
      .catch(() => {});

    function markActive() {
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (!limitMsRef.current) return; // disabled
      if (Date.now() - lastActivityRef.current >= limitMsRef.current) {
        logout();
      }
    }, 15000);

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [user, logout]);
}
