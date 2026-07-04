import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, login as apiLogin, logout as apiLogout, onUnauthorized, UnauthorizedError } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(new Set());
  const [checking, setChecking] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user, permissions } = await getMe();
      setUser(user);
      setPermissions(new Set(permissions));
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) console.error(err);
      setUser(null);
      setPermissions(new Set());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any 401 from anywhere in the app (a stale/duplicated tab, a session
  // that expired or was invalidated elsewhere) immediately drops us back
  // to the login screen instead of leaving stale "logged in" UI up with
  // every action silently failing.
  useEffect(() => {
    return onUnauthorized(() => {
      setUser((prev) => {
        if (prev) setSessionExpired(true);
        return null;
      });
      setPermissions(new Set());
    });
  }, []);

  // Catches the case where nothing has made a request yet — e.g. a
  // duplicated tab that's just sitting on a page with no active polling.
  // Re-checks as soon as the tab becomes visible/focused again.
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [refresh]);

  async function login(username, password) {
    setSessionExpired(false);
    const loggedInUser = await apiLogin(username, password);
    await refresh();
    return loggedInUser;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
    setPermissions(new Set());
    setSessionExpired(false);
  }

  function can(permission) {
    return permissions.has(permission);
  }

  return (
    <AuthContext.Provider
      value={{ user, permissions, checking, sessionExpired, login, logout, can, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
