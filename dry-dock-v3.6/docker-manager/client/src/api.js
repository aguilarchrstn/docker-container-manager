// Tracks which node (environment) container/image/monitoring calls target.
// A module-level value (rather than threading it through every component)
// keeps every existing page — Containers.jsx, Images.jsx, Monitoring.jsx —
// working unchanged; they already call listContainers() etc. with no args.
let currentEnvironmentId = "local";

export function setCurrentEnvironment(id) {
  currentEnvironmentId = id || "local";
}

export function getCurrentEnvironment() {
  return currentEnvironmentId;
}

function withEnv(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}env=${encodeURIComponent(currentEnvironmentId)}`;
}

export class UnauthorizedError extends Error {}

// Whenever ANY request gets a 401 — not just the initial /auth/me check on
// load — every subscriber is notified. AuthContext uses this to force an
// immediate logout state, which is what makes a second tab (or a tab left
// open after someone else's session cookie expired/was cleared) snap back
// to the login screen instead of sitting there looking logged in while
// every action silently fails.
const unauthorizedListeners = new Set();
export function onUnauthorized(cb) {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}
function notifyUnauthorized() {
  for (const cb of unauthorizedListeners) cb();
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    notifyUnauthorized();
    throw new UnauthorizedError("Not authenticated");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------- auth ----------

export const login = (username, password) =>
  request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }).then(
    (r) => r.user
  );

export const logout = () => request("/auth/logout", { method: "POST" });

export const getMe = () => request("/auth/me");

export const changePassword = (currentPassword, newPassword) =>
  request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const updateMyProfile = (displayName) =>
  request("/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName }) }).then((r) => r.user);

// ---------- containers (environment-scoped) ----------

export const listContainers = () => request(withEnv("/containers")).then((r) => r.containers);

export const getContainerLogs = (id, tail = 200) =>
  request(withEnv(`/containers/${id}/logs?tail=${tail}`)).then((r) => r.logs);

// EventSource can't go through the request() wrapper (it needs a plain
// URL, not a fetch call) — this just builds the same env-scoped path.
export const getContainerLogsStreamUrl = (id, tail = 100) =>
  withEnv(`/api/containers/${id}/logs/stream?tail=${tail}`);

export const startContainer = (id) => request(withEnv(`/containers/${id}/start`), { method: "POST" });

export const stopContainer = (id) => request(withEnv(`/containers/${id}/stop`), { method: "POST" });

export const restartContainer = (id) => request(withEnv(`/containers/${id}/restart`), { method: "POST" });

export const killContainer = (id) => request(withEnv(`/containers/${id}/kill`), { method: "POST" });

export const pauseContainer = (id) => request(withEnv(`/containers/${id}/pause`), { method: "POST" });

export const resumeContainer = (id) => request(withEnv(`/containers/${id}/unpause`), { method: "POST" });

export const removeContainer = (id, force = false) =>
  request(withEnv(`/containers/${id}?force=${force}`), { method: "DELETE" });

export const createContainer = (payload) =>
  request(withEnv("/containers"), { method: "POST", body: JSON.stringify(payload) });

export const getContainerStats = (id) => request(withEnv(`/containers/${id}/stats`)).then((r) => r.stats);

export const getAllContainerStats = () =>
  request(withEnv("/containers/stats/summary")).then((r) => ({ stats: r.stats, source: r.source }));

export const getSystemStats = () => request(withEnv("/system-stats"));

// ---------- images (environment-scoped) ----------

export const listImages = () => request(withEnv("/images")).then((r) => r.images);

export const removeImage = (id, force = false) =>
  request(withEnv(`/images/${id}?force=${force}`), { method: "DELETE" });

export async function pullImage(image, onProgress) {
  const res = await fetch(withEnv("/api/images/pull"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized();
    throw new Error(`Pull failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onProgress?.(JSON.parse(line));
      } catch {
        // ignore malformed progress line
      }
    }
  }
}

// ---------- theme / presets ----------

export const getTheme = () => request("/theme").then((r) => r.theme);

export const saveTheme = (theme) => request("/theme", { method: "PUT", body: JSON.stringify({ theme }) });

export const listCustomPresets = () => request("/presets").then((r) => r.presets);

export const createCustomPreset = (preset) =>
  request("/presets", { method: "POST", body: JSON.stringify(preset) }).then((r) => r.preset);

export const deleteCustomPreset = (id) => request(`/presets/${id}`, { method: "DELETE" });

// ---------- dashboard ----------

export const getDashboard = () => request("/dashboard").then((r) => r.environments);

// ---------- environments (nodes) ----------

export const listEnvironments = () => request("/environments").then((r) => r.environments);

export const testEnvironmentConnection = (type, config) =>
  request("/environments/test", { method: "POST", body: JSON.stringify({ type, config }) });

export const createEnvironment = (payload) =>
  request("/environments", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.environment);

export const updateEnvironment = (id, payload) =>
  request(`/environments/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.environment);

export const deleteEnvironment = (id) => request(`/environments/${id}`, { method: "DELETE" });

export const reorderEnvironments = (order) =>
  request("/environments/reorder", { method: "PUT", body: JSON.stringify({ order }) });

export const getAgentToken = () => request("/environments/agent-token").then((r) => r.agentToken);

export const regenerateAgentToken = () =>
  request("/environments/agent-token/regenerate", { method: "POST" }).then((r) => r.agentToken);

export const testCadvisorConnection = (cadvisorUrl) =>
  request("/environments/cadvisor-test", { method: "POST", body: JSON.stringify({ cadvisorUrl }) });

// ---------- access control: users / teams / roles ----------

export const listUsers = () => request("/users").then((r) => r.users);
export const createUser = (payload) =>
  request("/users", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.user);
export const updateUser = (id, payload) =>
  request(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.user);
export const deleteUser = (id) => request(`/users/${id}`, { method: "DELETE" });

export const listTeams = () => request("/teams").then((r) => r.teams);
export const createTeam = (payload) =>
  request("/teams", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.team);
export const updateTeam = (id, payload) =>
  request(`/teams/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.team);
export const deleteTeam = (id) => request(`/teams/${id}`, { method: "DELETE" });

export const listRoles = () => request("/roles");
export const createRole = (payload) =>
  request("/roles", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.role);
export const updateRole = (id, payload) =>
  request(`/roles/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.role);
export const deleteRole = (id) => request(`/roles/${id}`, { method: "DELETE" });

// ---------- stacks (environment-scoped) ----------

export const listStacks = () => request(withEnv("/stacks")).then((r) => r.stacks);
export const getStack = (id) => request(withEnv(`/stacks/${encodeURIComponent(id)}`)).then((r) => r.stack);
export const createStack = (payload) =>
  request(withEnv("/stacks"), { method: "POST", body: JSON.stringify(payload) });
export const testStack = (compose) =>
  request(withEnv("/stacks/validate"), { method: "POST", body: JSON.stringify({ compose }) });
export const updateStack = (id, payload) =>
  request(withEnv(`/stacks/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(payload) });
export const startStack = (id) =>
  request(withEnv(`/stacks/${encodeURIComponent(id)}/start`), { method: "POST" });
export const stopStack = (id) =>
  request(withEnv(`/stacks/${encodeURIComponent(id)}/stop`), { method: "POST" });
export const deleteStack = (id) =>
  request(withEnv(`/stacks/${encodeURIComponent(id)}`), { method: "DELETE" });
export const getStackLogs = (id, tail = 200) =>
  request(withEnv(`/stacks/${encodeURIComponent(id)}/logs?tail=${tail}`)).then((r) => r.logs);

// ---------- volumes (environment-scoped) ----------

export const listVolumes = () => request(withEnv("/volumes")).then((r) => r.volumes);
export const createVolume = (payload) =>
  request(withEnv("/volumes"), { method: "POST", body: JSON.stringify(payload) });
export const removeVolume = (name, force = false) =>
  request(withEnv(`/volumes/${encodeURIComponent(name)}?force=${force}`), { method: "DELETE" });

// ---------- networks (environment-scoped) ----------

export const listNetworks = () => request(withEnv("/networks")).then((r) => r.networks);
export const createNetwork = (payload) =>
  request(withEnv("/networks"), { method: "POST", body: JSON.stringify(payload) });
export const removeNetwork = (id) =>
  request(withEnv(`/networks/${encodeURIComponent(id)}`), { method: "DELETE" });

// ---------- activity log ----------

export const listActivity = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", params.limit);
  if (params.since) qs.set("since", params.since);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/activity${suffix}`).then((r) => r.activity);
};
export const clearActivity = () => request("/activity", { method: "DELETE" });

// ---------- app settings ----------

export const getAppSettings = () => request("/settings");
export const updateAppSettings = (payload) =>
  request("/settings", { method: "PUT", body: JSON.stringify(payload) });
