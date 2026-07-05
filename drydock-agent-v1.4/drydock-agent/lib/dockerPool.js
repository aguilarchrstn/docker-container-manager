import { docker } from "./docker.js";

// The standalone agent only ever manages the Docker Engine it's deployed
// next to — there's no multi-node concept here, that lives in the full
// Dry Dock manager. containerHandlers.js calls getEngine(envId); the id is
// accepted and ignored so the exact same handler code can be reused
// unmodified between the manager and this lightweight agent.
export async function getEngine() {
  return docker;
}

// Same idea for stackHandlers.js's shelling-out-to-`docker compose` path —
// the agent always targets its own local Docker Engine, so this just
// forwards whatever DOCKER_HOST/DOCKER_SOCKET_PATH this agent itself was
// configured with (or nothing, letting the CLI use its own default).
export async function composeEnvVars() {
  if (process.env.DOCKER_HOST) return { DOCKER_HOST: process.env.DOCKER_HOST };
  if (process.env.DOCKER_SOCKET_PATH) return { DOCKER_HOST: `unix://${process.env.DOCKER_SOCKET_PATH}` };
  return {};
}
