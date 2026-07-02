const NAV = [
  { key: "containers", label: "Containers" },
  { key: "images", label: "Images" },
  { key: "settings", label: "Appearance" },
];

export default function Sidebar({ page, onNavigate, counts }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="mark" />
        Dry Dock
      </div>
      {NAV.map((item) => (
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
      <div className="sidebar-footer">docker-manager v1.0</div>
    </nav>
  );
}
