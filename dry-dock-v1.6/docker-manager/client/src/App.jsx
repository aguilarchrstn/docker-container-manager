import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import EnvironmentSwitcher from "./components/EnvironmentSwitcher.jsx";
import ChangePasswordModal from "./components/ChangePasswordModal.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import Containers from "./pages/Containers.jsx";
import Images from "./pages/Images.jsx";
import Appearance from "./pages/Settings.jsx";
import SystemSettings from "./pages/SystemSettings.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Admin from "./pages/Admin.jsx";
import Stacks from "./pages/Stacks.jsx";
import Activity from "./pages/Activity.jsx";
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
  stacks: { title: "Stacks", subtitle: "Deploy and manage groups of services with Docker Compose" },
  compose: { title: "Docker Compose Generator", subtitle: "Follow the guided steps to configure Dry Dock's deployment" },
  appearance: { title: "Appearance", subtitle: "Make it yours" },
  admin: { title: "Access Control", subtitle: "Users, teams, roles, and permissions" },
  activity: { title: "Activity", subtitle: "Who did what, and when" },
  settings: { title: "Settings", subtitle: "Log retention, notifications, and session behavior" },
};

// Pages that only make sense once a node has actually been selected —
// mirrors the sidebar's node-scoped subnav visibility.
const NODE_SCOPED_PAGES = new Set(["containers", "monitoring", "images", "stacks", "compose"]);

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
          <div className="flex-row">
            {(page === "containers" || page === "monitoring" || page === "images" || page === "stacks") && (
              <EnvironmentSwitcher />
            )}
            <NotificationBell />
          </div>
        </div>
        <div className="content">
          {page === "dashboard" && <Dashboard onSwitchEnvironment={setPage} />}
          {page === "containers" && <Containers />}
          {page === "monitoring" && <Monitoring />}
          {page === "images" && <Images />}
          {page === "stacks" && <Stacks />}
          {page === "compose" && <ComposeGenerator />}
          {page === "appearance" && <Appearance />}
          {page === "admin" && <Admin />}
          {page === "activity" && <Activity />}
          {page === "settings" && <SystemSettings />}
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
