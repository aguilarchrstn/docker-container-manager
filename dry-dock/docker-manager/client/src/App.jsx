import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Containers from "./pages/Containers.jsx";
import Images from "./pages/Images.jsx";
import Settings from "./pages/Settings.jsx";
import { listContainers, listImages } from "./api.js";

const TITLES = {
  containers: { title: "Containers", subtitle: "Start, stop, and inspect what's running" },
  images: { title: "Images", subtitle: "Pull new images or clear out old ones" },
  settings: { title: "Appearance", subtitle: "Make it yours" },
};

export default function App() {
  const [page, setPage] = useState("containers");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    function refreshCounts() {
      listContainers().then((c) => setCounts((prev) => ({ ...prev, containers: c.length }))).catch(() => {});
      listImages().then((i) => setCounts((prev) => ({ ...prev, images: i.length }))).catch(() => {});
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, 8000);
    return () => clearInterval(interval);
  }, []);

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
        </div>
        <div className="content">
          {page === "containers" && <Containers />}
          {page === "images" && <Images />}
          {page === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}
