import os from "os";

// Cache per docker client (identified by object identity).
const cache = new WeakMap();

// Docker sets the container's hostname to its own short ID by default,
// which is how most tools detect "am I in a container, and which one".
// Resolution is per-docker-client so multi-env doesn't get cross-contaminated.
export async function getSelfContainerId(docker) {
  if (cache.has(docker)) return cache.get(docker);
  let id = "";
  try {
    const hostname = os.hostname();
    const info = await docker.getContainer(hostname).inspect();
    id = info.Id;
  } catch {
    id = "";
  }
  cache.set(docker, id);
  return id;
}

export async function isSelfContainer(docker, id) {
  const selfId = await getSelfContainerId(docker);
  if (!selfId || !id) return false;
  return selfId === id || selfId.startsWith(id) || id.startsWith(selfId.slice(0, 12));
}
