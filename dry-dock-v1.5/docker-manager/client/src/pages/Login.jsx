import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import LogoMark from "../components/LogoMark.jsx";

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <LogoMark size={30} />
          <span className="sidebar-brand-word">Dry Dock</span>
        </div>
        <div className="login-subtitle">Sign in to manage your containers</div>

        {error && <div className="banner error">{error}</div>}
        {!error && sessionExpired && (
          <div className="banner">Your session ended — sign in again to continue.</div>
        )}

        <label className="field">
          <span>Username</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="username"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="login-hint">
          First time here? Default login is <code>admin</code> / <code>admin</code> — you'll
          be asked to change the password after signing in.
        </div>
      </form>
    </div>
  );
}
