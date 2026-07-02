const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "environments", label: "Environments" },
  { key: "containers", label: "Containers" },
  { key: "monitoring", label: "Monitoring" },
  { key: "images", label: "Images" },
  { key: "settings", label: "Appearance" },
  { key: "admin", label: "Administration", adminOnly: true },
];

export default function Sidebar({ page, onNavigate, counts, isAdmin }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="mark" />
        Dry Dock
      </div>
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
        <button
          key={item.key}
          className={`nav-item ${page === item.key ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          {item.label}
          {counts?.[item.key] != null && <span className="count">{counts[item.key]}</span>}
        </button>
      ))}
      <div className="sidebar-footer">dry-dock v1.1</div>
    </nav>
  );
}
