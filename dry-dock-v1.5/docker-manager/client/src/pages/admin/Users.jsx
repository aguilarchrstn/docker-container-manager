import { useEffect, useState } from "react";
import { listUsers, createUser, updateUser, deleteUser, listRoles } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function emptyForm() {
  return { username: "", displayName: "", password: "", roleIds: [] };
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(null); // null = closed, {} = create/edit
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listUsers().then(setUsers).catch((err) => setError(err.message));
    listRoles()
      .then((r) => setRoles(r.roles))
      .catch(() => {});
  }

  useEffect(refresh, []);

  function startCreate() {
    setForm({ ...emptyForm(), mode: "create" });
  }

  function startEdit(u) {
    setForm({ id: u.id, username: u.username, displayName: u.displayName, password: "", roleIds: u.roleIds || [], mode: "edit" });
  }

  function toggleRole(id) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((r) => r !== id) : [...f.roleIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (form.mode === "create") {
        await createUser({
          username: form.username,
          password: form.password,
          displayName: form.displayName,
          roleIds: form.roleIds,
        });
      } else {
        await updateUser(form.id, {
          displayName: form.displayName,
          roleIds: form.roleIds,
          password: form.password || undefined,
        });
      }
      setForm(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Remove user "${u.username}"?`)) return;
    try {
      await deleteUser(u.id);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  function roleNames(ids = []) {
    return ids.map((id) => roles.find((r) => r.id === id)?.name).filter(Boolean).join(", ") || "—";
  }

  return (
    <div>
      <div className="section-heading">
        <h2>Users</h2>
        <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Add user</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="admin-table">
        <div className="admin-table-header">
          <span>Username</span>
          <span>Display name</span>
          <span>Roles</span>
          <span></span>
        </div>
        {users.map((u) => (
          <div className="admin-table-row" key={u.id}>
            <span className="mono">{u.username}</span>
            <span>{u.displayName}</span>
            <span>{roleNames(u.roleIds)}</span>
            <span className="admin-table-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => startEdit(u)}>Edit</button>
              {u.username !== "admin" && u.id !== me?.id && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>Remove</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: "min(460px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.mode === "create" ? "Add user" : `Edit ${form.username}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>Close</button>
            </div>
            <form className="form-body" onSubmit={handleSubmit}>
              {form.mode === "create" && (
                <label className="form-label">
                  Username *
                  <input
                    className="form-input"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    autoFocus
                  />
                </label>
              )}
              <label className="form-label">
                Display name
                <input
                  className="form-input"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </label>
              <label className="form-label">
                {form.mode === "create" ? "Password *" : "Reset password"}
                <input
                  className="form-input"
                  type="password"
                  placeholder={form.mode === "edit" ? "leave blank to keep current password" : ""}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </label>
              <div className="form-section">
                <div className="form-section-title">Roles</div>
                {roles.map((r) => (
                  <label className="form-checkbox" key={r.id}>
                    <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
