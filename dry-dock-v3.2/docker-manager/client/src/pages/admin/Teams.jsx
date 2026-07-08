import { useEffect, useState } from "react";
import { listTeams, createTeam, updateTeam, deleteTeam, listUsers, listRoles } from "../../api.js";

function emptyForm() {
  return { name: "", description: "", memberIds: [], roleIds: [] };
}

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listTeams().then(setTeams).catch((err) => setError(err.message));
    listUsers().then(setUsers).catch(() => {});
    listRoles().then((r) => setRoles(r.roles)).catch(() => {});
  }

  useEffect(refresh, []);

  function startCreate() {
    setForm({ ...emptyForm(), mode: "create" });
  }
  function startEdit(t) {
    setForm({ id: t.id, name: t.name, description: t.description, memberIds: t.memberIds || [], roleIds: t.roleIds || [], mode: "edit" });
  }
  function toggle(field, id) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (form.mode === "create") {
        await createTeam({ name: form.name, description: form.description, memberIds: form.memberIds, roleIds: form.roleIds });
      } else {
        await updateTeam(form.id, { name: form.name, description: form.description, memberIds: form.memberIds, roleIds: form.roleIds });
      }
      setForm(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(t) {
    if (!confirm(`Remove team "${t.name}"?`)) return;
    try {
      await deleteTeam(t.id);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  function names(ids = [], list, key) {
    return ids.map((id) => list.find((x) => x.id === id)?.[key]).filter(Boolean).join(", ") || "—";
  }

  return (
    <div>
      <div className="section-heading">
        <h2>Teams</h2>
        <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Add team</button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="admin-table">
        <div className="admin-table-header">
          <span>Name</span>
          <span className="col-center">Members</span>
          <span className="col-center">Roles</span>
          <span></span>
        </div>
        {teams.map((t) => (
          <div className="admin-table-row" key={t.id}>
            <span>{t.name}{t.builtin && <span className="field-hint"> (default)</span>}</span>
            <span className="col-center">{names(t.memberIds, users, "username")}</span>
            <span className="col-center">{names(t.roleIds, roles, "name")}</span>
            <span className="admin-table-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => startEdit(t)}>Edit</button>
              {!t.builtin && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t)}>Remove</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: "min(500px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.mode === "create" ? "Add team" : `Edit ${form.name}`}</h2>
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
                <div className="form-section-title">Members</div>
                {users.map((u) => (
                  <label className="form-checkbox" key={u.id}>
                    <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggle("memberIds", u.id)} />
                    {u.username}
                  </label>
                ))}
              </div>
              <div className="form-section">
                <div className="form-section-title">Roles granted to this team</div>
                {roles.map((r) => (
                  <label className="form-checkbox" key={r.id}>
                    <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggle("roleIds", r.id)} />
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
