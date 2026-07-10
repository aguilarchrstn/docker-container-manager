import { useEffect } from "react";
import { useMinLoadingTime } from "./useMinLoadingTime.js";
import { useEnvironment } from "../context/EnvironmentContext.jsx";

// For node-scoped pages (Containers, Images, Monitoring, Volumes,
// Networks, Stacks): reports the page's real `loading` state into
// EnvironmentContext as it happens, so the topbar switcher's "Switching…"
// indicator reflects actual data loading for the newly-selected node
// instead of a fixed timer that's disconnected from reality. Also returns
// the page's own delayed-appearance spinner flag, same as
// useMinLoadingTime, so this is a drop-in replacement for that at these
// call sites.
export function useNodeLoading(loading, delay = 120) {
  const { setSwitching } = useEnvironment();

  useEffect(() => {
    setSwitching(loading);
    return () => setSwitching(false);
  }, [loading, setSwitching]);

  return useMinLoadingTime(loading, delay);
}
