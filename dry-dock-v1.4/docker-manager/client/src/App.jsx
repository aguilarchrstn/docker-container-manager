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
import { EnvironmentProvider, useEnvironment } from "./context/EnvironmentContext.jsx";
import { listContainers, listImages } from "./api.js";

const TITLES = {
  dashboard: { title: "Dashboard", subtitle: "Every environment Dry Dock manages, at a glance" },
  containers: { title: "Containers", subtitle: "Start, stop, and inspect what's running" },
  monitoring: { title: "Monitoring", subtitle: "Live CPU, memory, network, and disk metrics" },
  images: { title: "Images", subtitle: "Pull new images or clear out old ones" },
  compose: { title: "Docker Compose Generator", subtitle: "Follow the guided steps to configure Dry Dock's deployment" },
  settings: { title: "Appearance", subtitle: "Make it yours" },
  admin: { title: "Access Control", subtitle: "Users, teams, roles, and permissions" },
};

// Pages that only make sense once a node has actually been selected —
// mirrors the sidebar's node-scoped subnav visibility.
const NODE_SCOPED_PAGES = new Set(["containers", "monitoring", "images", "compose"]);

function AppBody() {
  const { hasSelected, currentId } = useEnvironment();
  const [page, setPage] = useState("dashboard");
  const [counts, setCounts] = useState({});

  // If a node-scoped page is active but nothing's selected (fresh session,
  // or the selection was somehow lost), fall back to the Dashboard rather
  // than showing an empty/broken page.
  useEffect(() => {
    if (NODE_SCOPED_PAGES.has(page) && !hasSelected) setPage("dashboard");
  }, [page, hasSelected]);

  useEffect(() => {
    if (!hasSelected) return;
    function refreshCounts() {
      listContainers().then((c) => setCounts((prev) => ({ ...prev, containers: c.length }))).catch(() => {});
      listImages().then((i) => setCounts((prev) => ({ ...prev, images: i.length }))).catch(() => {});
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, 8000);
    return () => clearInterval(interval);
  }, [hasSelected, currentId]);

  const meta = TITLES[page];

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
            <EnvironmentSwitcher />
          )}
        </div>
        <div className="content">
          {page === "dashboard" && <Dashboard onSwitchEnvironment={setPage} />}
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

function Shell() {
  const { user, checking } = useAuth();

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

  return (
    <EnvironmentProvider>
      <AppBody />
    </EnvironmentProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
