const TOKEN_KEY = "drydock.token";
const ENV_KEY = "drydock.env";

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
};

export const env = {
  getId: () => localStorage.getItem(ENV_KEY),
  setId: (id) => (id ? localStorage.setItem(ENV_KEY, id) : localStorage.removeItem(ENV_KEY)),
};

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const envId = env.getId();
  if (envId) headers["x-env-id"] = envId;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401 && !path.startsWith("/auth")) {
    auth.setToken(null);
    window.dispatchEvent(new Event("drydock:signout"));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Auth ----
export const login = (username, password) =>
  request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
export const me = () => request("/auth/me").then((r) => r.user);
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

// ---- Dashboard ----
export const getDashboard = () => request("/dashboard");

// ---- Environments ----
export const listEnvironments = () => request("/environments").then((r) => r.environments);
export const pingEnvironment = (id) => request(`/environments/${id}/ping`);
export const createEnvironment = (payload) =>
  request("/environments", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.environment);
export const updateEnvironment = (id, payload) =>
  request(`/environments/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.environment);
export const deleteEnvironment = (id) => request(`/environments/${id}`, { method: "DELETE" });
export const testEnvironment = (payload) =>
  request("/environments/test", { method: "POST", body: JSON.stringify(payload) });

// ---- Containers ----
export const listContainers = () => request("/containers").then((r) => r.containers);
export const getContainerLogs = (id, tail = 200) =>
  request(`/containers/${id}/logs?tail=${tail}`).then((r) => r.logs);
export const startContainer = (id) => request(`/containers/${id}/start`, { method: "POST" });
export const stopContainer = (id) => request(`/containers/${id}/stop`, { method: "POST" });
export const restartContainer = (id) => request(`/containers/${id}/restart`, { method: "POST" });
export const killContainer = (id) => request(`/containers/${id}/kill`, { method: "POST" });
export const pauseContainer = (id) => request(`/containers/${id}/pause`, { method: "POST" });
export const resumeContainer = (id) => request(`/containers/${id}/unpause`, { method: "POST" });
export const removeContainer = (id, force = false) =>
  request(`/containers/${id}?force=${force}`, { method: "DELETE" });
export const createContainer = (payload) =>
  request("/containers", { method: "POST", body: JSON.stringify(payload) });
export const getContainerStats = (id) => request(`/containers/${id}/stats`).then((r) => r.stats);
export const getAllContainerStats = () => request("/containers/stats/summary").then((r) => r.stats);

// ---- Images ----
export const listImages = () => request("/images").then((r) => r.images);
export const removeImage = (id, force = false) =>
  request(`/images/${id}?force=${force}`, { method: "DELETE" });

export async function pullImage(image, onProgress) {
  const token = auth.getToken();
  const envId = env.getId();
  const res = await fetch("/api/images/pull", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(envId ? { "x-env-id": envId } : {}),
    },
    body: JSON.stringify({ image }),
  });
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
      try { onProgress?.(JSON.parse(line)); } catch { /* ignore */ }
    }
  }
}

// ---- Theme / presets ----
export const getTheme = () => request("/theme").then((r) => r.theme);
export const saveTheme = (theme) =>
  request("/theme", { method: "PUT", body: JSON.stringify({ theme }) });
export const listCustomPresets = () => request("/presets").then((r) => r.presets);
export const createCustomPreset = (preset) =>
  request("/presets", { method: "POST", body: JSON.stringify(preset) }).then((r) => r.preset);
export const deleteCustomPreset = (id) => request(`/presets/${id}`, { method: "DELETE" });

// ---- Admin ----
export const adminListUsers = () => request("/admin/users").then((r) => r.users);
export const adminCreateUser = (payload) =>
  request("/admin/users", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.user);
export const adminUpdateUser = (id, payload) =>
  request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteUser = (id) => request(`/admin/users/${id}`, { method: "DELETE" });

export const adminListRoles = () => request("/admin/roles").then((r) => r.roles);
export const adminCreateRole = (payload) =>
  request("/admin/roles", { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateRole = (id, payload) =>
  request(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteRole = (id) => request(`/admin/roles/${id}`, { method: "DELETE" });

export const adminListPermissions = () => request("/admin/permissions").then((r) => r.permissions);

export const adminListTeams = () => request("/admin/teams").then((r) => r.teams);
export const adminCreateTeam = (payload) =>
  request("/admin/teams", { method: "POST", body: JSON.stringify(payload) });
export const adminUpdateTeam = (id, payload) =>
  request(`/admin/teams/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const adminDeleteTeam = (id) => request(`/admin/teams/${id}`, { method: "DELETE" });
