import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";

// "Dashboard" is a section header whose children are the operational pages.
const DASHBOARD_NAV = [
  { key: "dashboard", label: "Overview" },
  { key: "containers", label: "Containers", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "monitoring", label: "Monitoring", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "images", label: "Images", permission: PERMISSIONS.IMAGES_VIEW },
  { key: "compose", label: "Compose Generator" },
];

// Administrator section. Appearance sits under Access Control per request.
const ADMIN_NAV = [
  { key: "admin", label: "Access Control", permission: PERMISSIONS.USERS_MANAGE },
  { key: "settings", label: "Appearance" },
];

export default function Sidebar({ page, onNavigate, counts }) {
  const { user, can, logout } = useAuth();

  const dashItems = DASHBOARD_NAV.filter((i) => !i.permission || can(i.permission));
  const adminItems = ADMIN_NAV.filter((i) => !i.permission || can(i.permission));

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="mark" />
        Dry Dock
      </div>

      <div className="sidebar-section-label">Dashboard</div>
      {dashItems.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${page === item.key ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          {item.label}
          {counts?.[item.key] != null && <span className="count">{counts[item.key]}</span>}
        </button>
      ))}

      {adminItems.length > 0 && (
        <>
          <div className="sidebar-section-label">Administrator</div>
          {adminItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${page === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.displayName || user?.username}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
        <div>Dry Dock v1.2</div>
      </div>
    </nav>
  );
}
