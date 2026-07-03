import os from "os";
import { docker } from "./docker.js";

let cachedSelfId; // undefined = not resolved yet, "" = not running in a container

// Docker sets the container's hostname to its own short ID by default,
// which is how most tools (Portainer included) detect "am I in a container,
// and which one". If this app isn't running in a container (e.g. `npm run
// dev` on a laptop), resolution just fails harmlessly and nothing is
// excluded.
export async function getSelfContainerId() {
  if (cachedSelfId !== undefined) return cachedSelfId;
  try {
    const hostname = os.hostname();
    const info = await docker.getContainer(hostname).inspect();
    cachedSelfId = info.Id;
  } catch {
    cachedSelfId = "";
  }
  return cachedSelfId;
}

export async function isSelfContainer(id) {
  const selfId = await getSelfContainerId();
  if (!selfId || !id) return false;
  return selfId === id || selfId.startsWith(id) || id.startsWith(selfId.slice(0, 12));
}
