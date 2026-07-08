import { useEffect, useState } from "react";
import { listRoles, createRole, updateRole, deleteRole } from "../../api.js";

const PERMISSION_LABELS = {
  "containers.view": "View containers",
  "containers.manage": "Manage containers (start/stop/create/remove)",
  "images.view": "View images",
  "images.manage": "Manage images (pull/remove)",
  "stacks.view": "View stacks",
  "stacks.manage": "Manage stacks (deploy/update/start/stop/remove)",
  "environments.view": "View environments",
  "environments.manage": "Manage environments (add/edit/remove nodes)",
  "appearance.manage": "Manage appearance/theme",
  "users.manage": "Manage users",
  "teams.manage": "Manage teams",
  "roles.manage": "Manage roles",
  "activity.view": "View the activity log",
  "activity.manage": "Clear the activity log",
  "settings.manage": "Manage app settings (log retention, notifications, session duration)",
};

function emptyForm() {
  return { name: "", description: "", permissions: [] };
}

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listRoles()
      .then((r) => {
        setRoles(r.roles);
        setAvailablePermissions(r.availablePermissions);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  function startCreate() {
    setForm({ ...emptyForm(), mode: "create" });
  }
  function startEdit(r) {
    setForm({ id: r.id, name: r.name, description: r.description, permissions: r.permissions || [], builtin: r.builtin, mode: "edit" });
  }
  function togglePermission(p) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (form.mode === "create") {
        await createRole({ name: form.name, description: form.description, permissions: form.permissions });
      } else {
        await updateRole(form.id, { name: form.name, description: form.description, permissions: form.permissions });
      }
      setForm(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(r) {
    if (!confirm(`Remove role "${r.name}"?`)) return;
    try {
      await deleteRole(r.id);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <h2>Roles</h2>
        <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Add role</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="admin-table">
        <div className="admin-table-header">
          <span>Name</span>
          <span className="col-center">Description</span>
          <span className="col-center">Permissions</span>
          <span></span>
        </div>
        {roles.map((r) => (
          <div className="admin-table-row" key={r.id}>
            <span>{r.name}{r.builtin && <span className="field-hint"> (built-in)</span>}</span>
            <span className="col-center">{r.description}</span>
            <span className="col-center">{r.permissions?.length || 0} granted</span>
            <span className="admin-table-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => startEdit(r)}>Edit</button>
              {!r.builtin && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)}>Remove</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: "min(520px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.mode === "create" ? "Add role" : `Edit ${form.name}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>Close</button>
            </div>
            <form className="form-body" onSubmit={handleSubmit}>
              <label className="form-label">
                Name *
                <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              </label>
              <label className="form-label">
                Description
                <input className="form-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
              <div className="form-section">
                <div className="form-section-title">Permissions</div>
                {availablePermissions.map((p) => (
                  <label className="form-checkbox" key={p}>
                    <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePermission(p)} />
                    {PERMISSION_LABELS[p] || p}
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
