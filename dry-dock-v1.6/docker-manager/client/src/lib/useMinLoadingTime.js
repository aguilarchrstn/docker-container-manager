import { useEffect, useRef, useState } from "react";

// Once `loading` goes true, this stays true for at least `min` ms even if
// the underlying request finishes sooner — a plain `if (loading)` flashes
// a spinner for 40ms on a fast local request, which reads as a glitch
// more than a loading state. This makes it feel intentional instead.
export function useMinLoadingTime(loading, min = 500) {
  const [visible, setVisible] = useState(loading);
  const startRef = useRef(loading ? Date.now() : null);

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now();
      setVisible(true);
      return;
    }
    if (startRef.current == null) {
      setVisible(false);
      return;
    }
    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(0, min - elapsed);
    const timer = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(timer);
  }, [loading, min]);

  return visible;
}
