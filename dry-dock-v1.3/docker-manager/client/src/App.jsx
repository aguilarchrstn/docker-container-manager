import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import EnvironmentSwitcher from "./components/EnvironmentSwitcher.jsx";
import ChangePasswordModal from "./components/ChangePasswordModal.jsx";
import Containers from "./pages/Containers.jsx";
import Images from "./pages/Images.jsx";
import Settings from "./pages/Settings.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Admin from "./pages/Admin.jsx";
import ComposeGenerator from "./pages/ComposeGenerator.jsx";
import Login from "./pages/Login.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { listContainers, listImages, setCurrentEnvironment } from "./api.js";

const TITLES = {
  dashboard: { title: "Dashboard", subtitle: "Every environment Dry Dock manages, at a glance" },
  containers: { title: "Containers", subtitle: "Start, stop, and inspect what's running" },
  monitoring: { title: "Monitoring", subtitle: "Live CPU, memory, network, and disk metrics" },
  images: { title: "Images", subtitle: "Pull new images or clear out old ones" },
  compose: { title: "Docker Compose Generator", subtitle: "Follow the guided steps to configure Dry Dock's deployment" },
  settings: { title: "Appearance", subtitle: "Make it yours" },
  admin: { title: "Access Control", subtitle: "Users, teams, roles, and permissions" },
};

function Shell() {
  const { user, checking } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [counts, setCounts] = useState({});
  const [envRefreshKey, setEnvRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    function refreshCounts() {
      listContainers().then((c) => setCounts((prev) => ({ ...prev, containers: c.length }))).catch(() => {});
      listImages().then((i) => setCounts((prev) => ({ ...prev, images: i.length }))).catch(() => {});
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, 8000);
    return () => clearInterval(interval);
  }, [user, page]);

  if (checking) {
    return <div className="login-shell"><div className="login-hint">Loading…</div></div>;
  }

  if (!user) {
    return <Login />;
  }

  if (user.mustChangePassword) {
    return (
      <ChangePasswordModal
        currentIsDefault
        onDone={() => {
          /* AuthContext.refresh() inside the modal updates `user` */
        }}
      />
    );
  }

  const meta = TITLES[page];

  function handleSwitchEnvironment(id) {
    setCurrentEnvironment(id);
    setPage("containers");
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} counts={counts} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <div className="subtitle">{meta.subtitle}</div>
          </div>
          {(page === "containers" || page === "monitoring" || page === "images") && (
            <EnvironmentSwitcher key={envRefreshKey} />
          )}
        </div>
        <div className="content">
          {page === "dashboard" && (
            <Dashboard
              onSwitchEnvironment={handleSwitchEnvironment}
              onEnvironmentsChanged={() => setEnvRefreshKey((k) => k + 1)}
            />
          )}
          {page === "containers" && <Containers />}
          {page === "monitoring" && <Monitoring />}
          {page === "images" && <Images />}
          {page === "compose" && <ComposeGenerator />}
          {page === "settings" && <Settings />}
          {page === "admin" && <Admin />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
