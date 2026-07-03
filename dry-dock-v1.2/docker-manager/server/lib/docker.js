import Docker from "dockerode";

// Connects to the Docker Engine via the local unix socket.
// Override with DOCKER_SOCKET_PATH if the socket is mounted elsewhere,
// or DOCKER_HOST (tcp://host:port) if you'd rather talk over TCP.
const socketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";

export const docker = process.env.DOCKER_HOST
  ? new Docker() // dockerode reads DOCKER_HOST/DOCKER_TLS_VERIFY automatically
  : new Docker({ socketPath });

export async function assertDockerReachable() {
  try {
    await docker.ping();
    return true;
  } catch (err) {
    console.error(
      "\n[docker-manager] Could not reach the Docker Engine.\n" +
        `  socketPath: ${socketPath}\n` +
        "  Make sure /var/run/docker.sock is mounted into this container, e.g.\n" +
        "  -v /var/run/docker.sock:/var/run/docker.sock\n"
    );
    return false;
  }
}
