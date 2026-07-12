import { useState } from "react";
import { updateMyProfile, changePassword } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MyAccountModal({ onClose }) {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      setProfileError("Display name can't be empty");
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await updateMyProfile(displayName.trim());
      await refresh();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    if (newPassword.length < 4) {
      setPasswordError("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(460px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My account</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <form className="form-body" onSubmit={handleSaveProfile}>
          <div className="form-section-title">Profile</div>
          {profileError && <div className="banner error">{profileError}</div>}
          {profileSaved && <div className="banner">Saved.</div>}

          <label className="form-label">
            Username
            <input className="form-input" value={user?.username || ""} disabled />
            <span className="field-hint">Usernames can't be changed.</span>
          </label>
          <label className="form-label">
            Display name
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </form>

        <form className="form-body" onSubmit={handleSavePassword} style={{ paddingTop: 0 }}>
          <div className="form-section-title">Password</div>
          {passwordError && <div className="banner error">{passwordError}</div>}
          {passwordSaved && <div className="banner">Password updated.</div>}

          <label className="form-label">
            Current password
            <input
              className="form-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={passwordSaving}>
            {passwordSaving ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
