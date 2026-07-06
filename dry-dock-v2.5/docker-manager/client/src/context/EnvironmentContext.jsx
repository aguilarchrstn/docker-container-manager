import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { listEnvironments, setCurrentEnvironment } from "../api.js";

const EnvironmentContext = createContext(null);

const STORAGE_ID = "drydock_current_env";
const STORAGE_SELECTED = "drydock_env_selected";

export function EnvironmentProvider({ children }) {
  const [environments, setEnvironments] = useState([]);
  const [currentId, setCurrentIdState] = useState(() => sessionStorage.getItem(STORAGE_ID) || "local");
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

  useEffect(() => {
    setCurrentEnvironment(currentId);
  }, [currentId]);

  const refreshEnvironments = useCallback(() => {
    return listEnvironments()
      .then(setEnvironments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshEnvironments();
  }, [refreshEnvironments]);

  function selectEnvironment(id) {
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
