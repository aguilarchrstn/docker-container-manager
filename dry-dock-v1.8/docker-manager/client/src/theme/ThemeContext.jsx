import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { presets } from "./presets.js";
import { getTheme, saveTheme } from "../api.js";

const ThemeContext = createContext(null);

function applyToDocument(colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
}

const LOCAL_KEY = "drydock-theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(presets[0]);
  const [status, setStatus] = useState("loading"); // loading | ready | offline

  useEffect(() => {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    } catch {
      // ignore corrupt cache
    }
    if (cached?.colors) {
      setTheme(cached);
      applyToDocument(cached.colors);
    }

    getTheme()
      .then((serverTheme) => {
        if (serverTheme?.colors) {
          setTheme(serverTheme);
          applyToDocument(serverTheme.colors);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(serverTheme));
        }
        setStatus("ready");
      })
      .catch(() => setStatus(cached ? "ready" : "offline"));
  }, []);

  const updateTheme = useCallback((next) => {
    setTheme(next);
    applyToDocument(next.colors);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  }, []);

  const persistTheme = useCallback(async (next) => {
    updateTheme(next);
    try {
      await saveTheme(next);
    } catch {
      // Saved locally even if the server round-trip fails — still usable.
    }
  }, [updateTheme]);

  return (
    <ThemeContext.Provider value={{ theme, status, updateTheme, persistTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
