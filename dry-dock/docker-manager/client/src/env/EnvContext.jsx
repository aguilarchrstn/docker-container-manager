import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { env as envStore, listEnvironments } from "../api.js";

const EnvContext = createContext(null);

export function EnvProvider({ children }) {
  const [environments, setEnvironments] = useState([]);
  const [currentId, setCurrentIdState] = useState(envStore.getId());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await listEnvironments();
      setEnvironments(list);
      // Auto-select a sensible default if nothing is chosen or the choice is stale.
      const stored = envStore.getId();
      const valid = stored && list.some((e) => e.id === stored);
      if (!valid) {
        const def = list.find((e) => e.isDefault) || list[0];
        if (def) {
          envStore.setId(def.id);
          setCurrentIdState(def.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setCurrentId = (id) => {
    envStore.setId(id);
    setCurrentIdState(id);
  };

  const current = environments.find((e) => e.id === currentId) || null;

  return (
    <EnvContext.Provider value={{ environments, current, currentId, setCurrentId, refresh, loading }}>
      {children}
    </EnvContext.Provider>
  );
}

export const useEnv = () => useContext(EnvContext);
