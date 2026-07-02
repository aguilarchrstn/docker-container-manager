import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Containers from "./pages/Containers.jsx";
import Images from "./pages/Images.jsx";
import Settings from "./pages/Settings.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Environments from "./pages/Environments.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";
import { listContainers, listImages } from "./api.js";
import { useAuth } from "./auth/AuthContext.jsx";
import { useEnv } from "./env/EnvContext.jsx";

const TITLES = {
  dashboard: { title: "Dashboard", subtitle: "Nodes, environments, and overall health" },
  environments: { title: "Environments", subtitle: "Connect Docker hosts and remote nodes" },
  containers: { title: "Containers", subtitle: "Start, stop, and inspect what's running" },
  monitoring: { title: "Monitoring", subtitle: "Live CPU, memory, network, and disk metrics" },
  images: { title: "Images", subtitle: "Pull new images or clear out old ones" },
  settings: { title: "Appearance", subtitle: "Make it yours" },
  admin: { title: "Administration", subtitle: "Users, teams, roles, and permissions" },
};

export default function App() {
  const { user, loading, signOut, hasPermission } = useAuth();
  const { environments, currentId, setCurrentId } = useEnv();
  const [page, setPage] = useState("dashboard");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!user) return;
    function refreshCounts() {
      listContainers().then((c) => setCounts((prev) => ({ ...prev, containers: c.length }))).catch(() => {});
      listImages().then((i) => setCounts((prev) => ({ ...prev, images: i.length }))).catch(() => {});
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, 8000);
    return () => clearInterval(interval);
  }, [user, currentId]);

  if (loading) return <div className="empty">Loading…</div>;
  if (!user) return <Login />;

  const meta = TITLES[page] || TITLES.dashboard;
  const isAdmin = hasPermission("admin");

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} counts={counts} isAdmin={isAdmin} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <div className="subtitle">{meta.subtitle}</div>
          </div>
          <div className="topbar-right">
            <label className="env-switch">
              <span>Environment</span>
              <select value={currentId || ""} onChange={(e) => setCurrentId(e.target.value)}>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <div className="user-menu">
              <span className="user-name">{user.display_name || user.username}</span>
              <button className="link" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </div>
        <div className="content">
          {page === "dashboard" && <Dashboard />}
          {page === "environments" && <Environments />}
          {page === "containers" && <Containers />}
          {page === "monitoring" && <Monitoring />}
          {page === "images" && <Images />}
          {page === "settings" && <Settings />}
          {page === "admin" && isAdmin && <Admin />}
        </div>
      </div>
    </div>
  );
}
