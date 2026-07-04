import { useAuth } from "../context/AuthContext.jsx";
import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { PERMISSIONS } from "../lib/permissions.js";
import LogoMark from "./LogoMark.jsx";

// Shown under "Dashboard" only once a node has actually been picked —
// there's nothing useful to look at on the Containers/Monitoring/Images/
// Stacks/Compose Generator pages before that.
const NODE_SCOPED_NAV = [
  { key: "containers", label: "Containers", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "monitoring", label: "Monitoring", permission: PERMISSIONS.CONTAINERS_VIEW },
  { key: "images", label: "Images", permission: PERMISSIONS.IMAGES_VIEW },
  { key: "stacks", label: "Stacks", permission: PERMISSIONS.STACKS_VIEW },
  { key: "compose", label: "Compose Generator", permission: PERMISSIONS.ENVIRONMENTS_MANAGE },
];

export default function Sidebar({ page, onNavigate, counts }) {
  const { user, can, logout } = useAuth();
  const { hasSelected } = useEnvironment();

  const nodeItems = NODE_SCOPED_NAV.filter((item) => !item.permission || can(item.permission));
  const showAccessControl = can(PERMISSIONS.USERS_MANAGE);
  const showAppearance = can(PERMISSIONS.APPEARANCE_MANAGE);
  const showActivity = can(PERMISSIONS.ACTIVITY_VIEW);
  const showSettings = can(PERMISSIONS.SETTINGS_MANAGE);
  const showAdminSection = showAccessControl || showAppearance || showActivity || showSettings;

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <LogoMark size={24} />
        <span className="sidebar-brand-word">Dry Dock</span>
      </div>

      <button
        className={`nav-item ${page === "dashboard" ? "active" : ""}`}
        onClick={() => onNavigate("dashboard")}
      >
        Dashboard
      </button>

      {hasSelected && nodeItems.length > 0 && (
        <div className="nav-subgroup">
          {nodeItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item nav-item-sub ${page === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
              {counts?.[item.key] != null && <span className="count">{counts[item.key]}</span>}
            </button>
          ))}
        </div>
      )}

      {showAdminSection && (
        <>
          <div className="sidebar-section-label">Administrator</div>
          {showAccessControl && (
            <button
              className={`nav-item ${page === "admin" ? "active" : ""}`}
              onClick={() => onNavigate("admin")}
            >
              Access Control
            </button>
          )}
          {showActivity && (
            <button
              className={`nav-item ${page === "activity" ? "active" : ""}`}
              onClick={() => onNavigate("activity")}
            >
              Activity
            </button>
          )}
          {showAppearance && (
            <button
              className={`nav-item ${page === "appearance" ? "active" : ""}`}
              onClick={() => onNavigate("appearance")}
            >
              Appearance
            </button>
          )}
          {showSettings && (
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => onNavigate("settings")}
            >
              Settings
            </button>
          )}
        </>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.displayName || user?.username}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
        <div>Dry Dock v1.7</div>
      </div>
    </nav>
  );
}
