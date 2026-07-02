async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const listContainers = () =>
  request("/containers").then((r) => r.containers);

export const getContainerLogs = (id, tail = 200) =>
  request(`/containers/${id}/logs?tail=${tail}`).then((r) => r.logs);

export const startContainer = (id) =>
  request(`/containers/${id}/start`, { method: "POST" });

export const stopContainer = (id) =>
  request(`/containers/${id}/stop`, { method: "POST" });

export const restartContainer = (id) =>
  request(`/containers/${id}/restart`, { method: "POST" });

export const removeContainer = (id, force = false) =>
  request(`/containers/${id}?force=${force}`, { method: "DELETE" });

export const listImages = () => request("/images").then((r) => r.images);

export const removeImage = (id, force = false) =>
  request(`/images/${id}?force=${force}`, { method: "DELETE" });

export async function pullImage(image, onProgress) {
  const res = await fetch("/api/images/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      try {
        onProgress?.(JSON.parse(line));
      } catch {
        // ignore malformed progress line
      }
    }
  }
}

export const getTheme = () => request("/theme").then((r) => r.theme);

export const saveTheme = (theme) =>
  request("/theme", { method: "PUT", body: JSON.stringify({ theme }) });
