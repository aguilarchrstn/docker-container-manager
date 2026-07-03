import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "containers", label: "Containers", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "monitoring", label: "Monitoring", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "images", label: "Images", permission: PERMISSIONS.IMAGES_VIEW },
  { key: "compose", label: "Compose Generator", permission: PERMISSIONS.ENVIRONMENTS_MANAGE },
  { key: "settings", label: "Appearance" },
];

const ADMIN_NAV = { key: "admin", label: "Access Control", permission: PERMISSIONS.USERS_MANAGE };

export default function Sidebar({ page, onNavigate, counts }) {
  const { user, can, logout } = useAuth();

  const items = NAV.filter((item) => !item.permission || can(item.permission));
  const showAdmin = can(ADMIN_NAV.permission);

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="mark" />
        Dry Dock
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${page === item.key ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          {item.label}
          {counts?.[item.key] != null && (
            <span className="count">{counts[item.key]}</span>
          )}
        </button>
      ))}

      {showAdmin && (
        <>
          <div className="sidebar-section-label">Governance</div>
          <button
            className={`nav-item ${page === ADMIN_NAV.key ? "active" : ""}`}
            onClick={() => onNavigate(ADMIN_NAV.key)}
          >
            {ADMIN_NAV.label}
          </button>
        </>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.displayName || user?.username}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
        <div>Dry Dock v1.1</div>
      </div>
    </nav>
  );
}
