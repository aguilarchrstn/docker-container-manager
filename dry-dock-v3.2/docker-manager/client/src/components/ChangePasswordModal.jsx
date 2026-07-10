import { useState } from "react";
import { changePassword } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function ChangePasswordModal({ currentIsDefault, onDone }) {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      await refresh();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: "min(420px, 100%)" }}>
        <div className="modal-header">
          <h2>Set a new password</h2>
        </div>
        <form onSubmit={handleSubmit} className="form-body">
          {currentIsDefault && (
            <div className="banner">
              You're signed in with the default password. Set your own before continuing.
            </div>
          )}
          {error && <div className="banner error">{error}</div>}

          <label className="form-label">
            Current password
            <input
              className="form-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          </label>
          <label className="form-label">
            New password
            <input
              className="form-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="form-label">
            Confirm new password
            <input
              className="form-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
