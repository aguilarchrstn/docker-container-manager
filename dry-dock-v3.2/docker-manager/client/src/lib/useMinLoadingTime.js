import { useEffect, useRef, useState } from "react";

// Shows a loading indicator only if `loading` is still true after a short
// delay — not a forced minimum display time. Fast responses (the common
// case on a local network) show nothing at all, which reads as instant;
// only genuinely slow requests get a spinner, and it appears/disappears
// exactly when the real loading state does — no artificial lag either
// way. (Kept the old export name so every existing call site — Containers,
// Images, Monitoring, Dashboard, Stacks, Activity — didn't need to change.)
export function useMinLoadingTime(loading, delay = 150) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      timerRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      clearTimeout(timerRef.current);
      setVisible(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [loading, delay]);

  return visible;
}
