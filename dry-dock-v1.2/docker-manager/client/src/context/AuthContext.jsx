import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, login as apiLogin, logout as apiLogout, UnauthorizedError } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(new Set());
  const [checking, setChecking] = useState(true);

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

  async function login(username, password) {
    const loggedInUser = await apiLogin(username, password);
    await refresh();
    return loggedInUser;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
    setPermissions(new Set());
  }

  function can(permission) {
    return permissions.has(permission);
  }

  return (
    <AuthContext.Provider value={{ user, permissions, checking, login, logout, can, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
