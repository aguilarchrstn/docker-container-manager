import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { listEnvironments, setCurrentEnvironment } from "../api.js";

const EnvironmentContext = createContext(null);

const STORAGE_ID = "drydock_current_env";
const STORAGE_SELECTED = "drydock_env_selected";

export function EnvironmentProvider({ children }) {
  const [environments, setEnvironments] = useState([]);
  const [currentId, setCurrentIdState] = useState(() => {
    const stored = sessionStorage.getItem(STORAGE_ID) || "local";
    // Set this synchronously during init, NOT in a useEffect — an effect
    // here would run after any child page's own data-fetching effect
    // (React runs effects child-first, parent-last), which is exactly
    // what caused switching nodes to briefly fetch the OLD node's data
    // with the NEW node already showing in the UI.
    setCurrentEnvironment(stored);
    return stored;
  });
  // Whether the person has EXPLICITLY picked a node this session (via the
  // Dashboard's "Manage this node" or the topbar switcher) — separate from
  // currentId defaulting to "local" internally, so the sidebar's
  // Containers/Monitoring/Images/Compose Generator links stay hidden until
  // they actually land somewhere.
  const [hasSelected, setHasSelected] = useState(() => sessionStorage.getItem(STORAGE_SELECTED) === "true");
  // Real loading state, not a fake timer — whichever node-scoped page is
  // active reports into this via setSwitching() while its data for the
  // newly-selected node is actually in flight, and clears it when that
  // fetch resolves (success or failure). The topbar switcher just reads it.
  const [switching, setSwitching] = useState(false);

  const refreshEnvironments = useCallback(() => {
    return listEnvironments()
      .then(setEnvironments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshEnvironments();
  }, [refreshEnvironments]);

  function selectEnvironment(id) {
    // Synchronous, same tick as the click — every child effect that fires
    // off this state change (any node-scoped page's data fetch) will see
    // the correct scoping the very first time it runs, no race.
    setCurrentEnvironment(id);
    setCurrentIdState(id);
    setHasSelected(true);
    sessionStorage.setItem(STORAGE_ID, id);
    sessionStorage.setItem(STORAGE_SELECTED, "true");
  }

  return (
    <EnvironmentContext.Provider
      value={{ environments, currentId, hasSelected, switching, setSwitching, selectEnvironment, refreshEnvironments }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) throw new Error("useEnvironment must be used within EnvironmentProvider");
  return ctx;
}
