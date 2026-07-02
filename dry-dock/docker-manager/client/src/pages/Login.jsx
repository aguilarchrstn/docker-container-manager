import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand"><span className="mark" /> Dry Dock</div>
        <h2>Sign in</h2>
        <p className="subtitle">Manage your Docker environments</p>

        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

        <div className="login-hint">
          Default admin: <code>admin</code> / <code>admin</code> — change this right after first login.
        </div>
      </form>
    </div>
  );
}
