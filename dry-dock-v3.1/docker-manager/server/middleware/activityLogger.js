import { logActivity } from "../lib/activity.js";

// Login/logout are logged explicitly in routes/auth.js instead (req.user
// isn't populated yet during login, so the generic path below can't
// attribute it correctly) — skip them here to avoid double-logging.
// /activity itself and background polling endpoints are skipped so
// viewing the log or the Dashboard doesn't spam the log about itself.
const SKIP_PATHS = ["/api/auth/login", "/api/auth/logout", "/api/auth/me"];
const SKIP_PREFIXES = ["/api/activity", "/api/dashboard"];

// Turns "POST /api/containers/abc123/start" into "Started container abc123"
// — covers the resources that matter (containers/images/stacks/
// environments/users/teams/roles/appearance); anything unrecognized still
// gets logged, just with a plainer fallback label.
function describe(method, urlPath) {
  const path = urlPath.split("?")[0];
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const [resource, a, b, c] = parts;
  const short = (id) => (id ? id.slice(0, 12) : "");

  const table = {
    containers: () => {
      if (method === "POST" && !a) return "Created a container";
      if (method === "DELETE" && a) return `Removed container ${short(a)}`;
      if (method === "POST" && a && b) return `${capitalize(pastTense(b))} container ${short(a)}`;
      return null;
    },
    images: () => {
      if (method === "POST" && a === "pull") return "Pulled an image";
      if (method === "DELETE" && a) return `Removed image ${short(a)}`;
      return null;
    },
    stacks: () => {
      if (method === "POST" && !a) return "Deployed a stack";
      if (method === "PUT" && a) return `Updated stack "${a}"`;
      if (method === "POST" && a && b === "start") return `Started stack "${a}"`;
      if (method === "POST" && a && b === "stop") return `Stopped stack "${a}"`;
      if (method === "DELETE" && a) return `Removed stack "${a}"`;
      return null;
    },
    environments: () => {
      if (method === "POST" && !a) return "Added an environment";
      if (method === "PUT" && a) return `Updated environment ${short(a)}`;
      if (method === "DELETE" && a) return `Removed environment ${short(a)}`;
      if (a === "agent-token" && b === "regenerate") return "Regenerated the agent token";
      return null;
    },
    users: () => {
      if (method === "POST" && !a) return "Created a user";
      if (method === "PUT" && a) return `Updated user ${short(a)}`;
      if (method === "DELETE" && a) return `Removed user ${short(a)}`;
      return null;
    },
    teams: () => {
      if (method === "POST" && !a) return "Created a team";
      if (method === "PUT" && a) return `Updated team ${short(a)}`;
      if (method === "DELETE" && a) return `Removed team ${short(a)}`;
      return null;
    },
    roles: () => {
      if (method === "POST" && !a) return "Created a role";
      if (method === "PUT" && a) return `Updated role ${short(a)}`;
      if (method === "DELETE" && a) return `Removed role ${short(a)}`;
      return null;
    },
    theme: () => (method === "PUT" ? "Updated the appearance theme" : null),
    presets: () => {
      if (method === "POST") return "Saved a theme preset";
      if (method === "PUT") return `Updated a theme preset`;
      if (method === "DELETE") return "Removed a theme preset";
      return null;
    },
    settings: () => (method === "PUT" ? "Updated app settings" : null),
  };

  const fn = table[resource];
  const label = fn ? fn() : null;
  return label || `${method} /${parts.join("/")}`;
}

function pastTense(action) {
  const map = { start: "started", stop: "stopped", restart: "restarted", kill: "killed", pause: "paused", unpause: "resumed" };
  return map[action] || action;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function activityLogger(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD") return next();
  if (SKIP_PATHS.includes(req.path)) return next();
  if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  res.on("finish", () => {
    const success = res.statusCode < 400;
    logActivity({
      actorId: req.user?.id || null,
      actorName: req.user?.displayName || req.user?.username || "Unknown",
      action: describe(req.method, req.path),
      environmentId: req.query?.env || null,
      statusCode: res.statusCode,
      success,
    }).catch(() => {});
  });

  next();
}
