import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth, login as apiLogin, me } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!auth.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await me();
      setUser(u);
    } catch {
      auth.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onSignout = () => setUser(null);
    window.addEventListener("drydock:signout", onSignout);
    return () => window.removeEventListener("drydock:signout", onSignout);
  }, [refresh]);

  const signIn = async (username, password) => {
    const { token, user } = await apiLogin(username, password);
    auth.setToken(token);
    setUser(user);
  };

  const signOut = () => {
    auth.setToken(null);
    setUser(null);
  };

  const hasPermission = (perm) =>
    !!user && (user.permissions?.includes("admin") || user.permissions?.includes(perm));

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
