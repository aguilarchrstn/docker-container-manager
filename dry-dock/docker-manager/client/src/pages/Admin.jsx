import { useEffect, useState } from "react";
import {
  adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminListRoles, adminCreateRole, adminUpdateRole, adminDeleteRole,
  adminListPermissions,
  adminListTeams, adminCreateTeam, adminUpdateTeam, adminDeleteTeam,
} from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Admin() {
  const [tab, setTab] = useState("users");
  return (
    <div>
      <div className="tabs">
        {["users", "teams", "roles", "permissions"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "users" && <UsersTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "permissions" && <PermissionsTab />}
    </div>
  );
}

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", roleIds: [] });

  async function load() {
    const [u, r] = await Promise.all([adminListUsers(), adminListRoles()]);
    setUsers(u); setRoles(r);
  }
  useEffect(() => { load(); }, []);

  function toggleRole(rid) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(rid) ? f.roleIds.filter((x) => x !== rid) : [...f.roleIds, rid],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    try {
      await adminCreateUser(form);
      setCreating(false);
      setForm({ username: "", password: "", displayName: "", roleIds: [] });
      await load();
    } catch (err) { alert(err.message); }
  }

  async function toggleUserRole(u, rid) {
    const roleIds = u.roles.map((r) => r.id);
    const next = roleIds.includes(rid) ? roleIds.filter((x) => x !== rid) : [...roleIds, rid];
    await adminUpdateUser(u.id, { roleIds: next });
    await load();
  }

  async function toggleDisabled(u) {
    await adminUpdateUser(u.id, { disabled: !u.disabled });
    await load();
  }

  async function del(u) {
    if (!confirm(`Delete user ${u.username}?`)) return;
    try { await adminDeleteUser(u.id); await load(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-actions">
        <button className="primary" onClick={() => setCreating(true)}>+ New user</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Username</th><th>Display name</th><th>Roles</th><th>Status</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}{u.id === currentUser.id && <span className="tag">you</span>}</td>
              <td>{u.display_name || "—"}</td>
              <td>
                <div className="role-chips">
                  {roles.map((r) => (
                    <label key={r.id} className={`chip ${u.roles.some((x) => x.id === r.id) ? "on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={u.roles.some((x) => x.id === r.id)}
                        onChange={() => toggleUserRole(u, r.id)}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </td>
              <td>{u.disabled ? "Disabled" : "Active"}</td>
              <td>
                <button onClick={() => toggleDisabled(u)}>{u.disabled ? "Enable" : "Disable"}</button>
                {u.id !== currentUser.id && <button className="danger" onClick={() => del(u)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="modal-header"><h3>New user</h3><button type="button" className="icon" onClick={() => setCreating(false)}>×</button></div>
            <div className="wizard-body">
              <label>Username</label>
              <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <label>Password</label>
              <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <label>Display name</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <label>Roles</label>
              <div className="role-chips">
                {roles.map((r) => (
                  <label key={r.id} className={`chip ${form.roleIds.includes(r.id) ? "on" : ""}`}>
                    <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <div style={{ flex: 1 }} />
              <button type="submit" className="primary">Create user</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    const [t, u] = await Promise.all([adminListTeams(), adminListUsers()]);
    setTeams(t); setUsers(u);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try { await adminCreateTeam({ name, description }); setName(""); setDescription(""); await load(); }
    catch (err) { alert(err.message); }
  }

  async function toggleMember(team, uid) {
    const ids = team.members.map((m) => m.id);
    const next = ids.includes(uid) ? ids.filter((x) => x !== uid) : [...ids, uid];
    await adminUpdateTeam(team.id, { memberIds: next });
    await load();
  }

  async function del(team) {
    if (!confirm(`Delete team ${team.name}?`)) return;
    await adminDeleteTeam(team.id);
    await load();
  }

  return (
    <>
      <form className="inline-form" onSubmit={create}>
        <input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="primary">Create team</button>
      </form>

      {teams.map((team) => (
        <div key={team.id} className="admin-block">
          <div className="admin-block-head">
            <div>
              <div className="admin-block-title">{team.name}</div>
              <div className="admin-block-sub">{team.description || "No description"}</div>
            </div>
            <button className="danger" onClick={() => del(team)}>Delete</button>
          </div>
          <div className="role-chips">
            {users.map((u) => (
              <label key={u.id} className={`chip ${team.members.some((m) => m.id === u.id) ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={team.members.some((m) => m.id === u.id)}
                  onChange={() => toggleMember(team, u.id)}
                />
                {u.username}
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [name, setName] = useState("");

  async function load() {
    const [r, p] = await Promise.all([adminListRoles(), adminListPermissions()]);
    setRoles(r); setPerms(p);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try { await adminCreateRole({ name, permissionKeys: [] }); setName(""); await load(); }
    catch (err) { alert(err.message); }
  }

  async function togglePerm(role, key) {
    const current = role.permissions || [];
    const next = current.includes(key) ? current.filter((x) => x !== key) : [...current, key];
    await adminUpdateRole(role.id, { permissionKeys: next });
    await load();
  }

  async function del(role) {
    if (!confirm(`Delete role ${role.name}?`)) return;
    try { await adminDeleteRole(role.id); await load(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <form className="inline-form" onSubmit={create}>
        <input placeholder="Role name (e.g. deployer)" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary">Create role</button>
      </form>

      {roles.map((role) => (
        <div key={role.id} className="admin-block">
          <div className="admin-block-head">
            <div>
              <div className="admin-block-title">{role.name} {role.is_system ? <span className="tag">system</span> : null}</div>
              <div className="admin-block-sub">{role.description || "—"}</div>
            </div>
            {!role.is_system && <button className="danger" onClick={() => del(role)}>Delete</button>}
          </div>
          <div className="role-chips">
            {perms.map((p) => (
              <label key={p.id} className={`chip ${role.permissions.includes(p.key) ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={role.permissions.includes(p.key)}
                  onChange={() => togglePerm(role, p.key)}
                />
                {p.key}
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function PermissionsTab() {
  const [perms, setPerms] = useState([]);
  useEffect(() => { adminListPermissions().then(setPerms); }, []);
  return (
    <table className="admin-table">
      <thead><tr><th>Key</th><th>Description</th></tr></thead>
      <tbody>
        {perms.map((p) => (
          <tr key={p.id}><td><code>{p.key}</code></td><td>{p.description}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
