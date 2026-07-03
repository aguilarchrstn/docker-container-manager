import { useState } from "react";
import Users from "./admin/Users.jsx";
import Teams from "./admin/Teams.jsx";
import Roles from "./admin/Roles.jsx";

const TABS = [
  { key: "users", label: "Users", Component: Users },
  { key: "teams", label: "Teams", Component: Teams },
  { key: "roles", label: "Roles", Component: Roles },
];

export default function Admin() {
  const [tab, setTab] = useState("users");
  const Active = TABS.find((t) => t.key === tab).Component;

  return (
    <div>
      <div className="mode-toggle" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`mode-toggle-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
