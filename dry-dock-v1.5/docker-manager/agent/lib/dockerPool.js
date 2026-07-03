import { docker } from "./docker.js";

// The standalone agent only ever manages the Docker Engine it's deployed
// next to — there's no multi-node concept here, that lives in the full
// Dry Dock manager. containerHandlers.js calls getEngine(envId); the id is
// accepted and ignored so the exact same handler code can be reused
// unmodified between the manager and this lightweight agent.
export async function getEngine() {
  return docker;
}
