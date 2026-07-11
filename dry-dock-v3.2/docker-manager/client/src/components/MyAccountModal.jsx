import { useEffect, useState } from "react";
import { updateMyProfile, changePassword, listApiTokens, createApiToken, deleteApiToken } from "../api.js";
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

  const [tokens, setTokens] = useState([]);
  const [tokenName, setTokenName] = useState("");
  const [tokenError, setTokenError] = useState(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [newTokenPlaintext, setNewTokenPlaintext] = useState(null);

  useEffect(() => {
    listApiTokens().then(setTokens).catch(() => {});
  }, []);

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

  async function handleCreateToken(e) {
    e.preventDefault();
    if (!tokenName.trim()) {
      setTokenError("Give this token a name");
      return;
    }
    setTokenBusy(true);
    setTokenError(null);
    try {
      const result = await createApiToken(tokenName.trim());
      setNewTokenPlaintext(result.plaintext);
      setTokens((prev) => [...prev, result.token]);
      setTokenName("");
    } catch (err) {
      setTokenError(err.message);
    } finally {
      setTokenBusy(false);
    }
  }

  async function handleRevokeToken(id) {
    if (!confirm("Revoke this token? Anything using it will stop working immediately.")) return;
    try {
      await deleteApiToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setTokenError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(520px, 100%)" }} onClick={(e) => e.stopPropagation()}>
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

        <div className="form-body" style={{ paddingTop: 0 }}>
          <div className="form-section-title">API tokens</div>
          <div className="field-hint" style={{ marginBottom: 10 }}>
            Personal access tokens for scripting against Dry Dock's API — send one as{" "}
            <code>Authorization: Bearer &lt;token&gt;</code> instead of signing in. They act with your exact
            permissions.
          </div>
          {tokenError && <div className="banner error">{tokenError}</div>}

          {newTokenPlaintext && (
            <div className="banner" style={{ wordBreak: "break-all" }}>
              <strong>Copy this now — you won't see it again:</strong>
              <div className="mono" style={{ marginTop: 6 }}>{newTokenPlaintext}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => {
                  navigator.clipboard.writeText(newTokenPlaintext);
                  setNewTokenPlaintext(null);
                }}
              >
                Copy & dismiss
              </button>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="admin-table" style={{ marginBottom: 12 }}>
              <div className="admin-table-header">
                <span>Name</span>
                <span>Token</span>
                <span>Last used</span>
                <span></span>
              </div>
              {tokens.map((t) => (
                <div className="admin-table-row" key={t.id}>
                  <span>{t.name}</span>
                  <span className="mono">{t.preview}</span>
                  <span className="field-hint">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "never"}</span>
                  <span className="admin-table-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleRevokeToken(t.id)}>Revoke</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <form className="flex-row" onSubmit={handleCreateToken}>
            <input
              className="form-input"
              placeholder="Token name, e.g. deploy-script"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={tokenBusy}>
              {tokenBusy ? "Creating…" : "New token"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
