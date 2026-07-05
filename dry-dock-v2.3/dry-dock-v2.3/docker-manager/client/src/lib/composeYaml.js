// Every field here maps to something Dry Dock's server actually reads
// (see server/lib/docker.js, auth.js, logger.js, entrypoint.sh). Nothing
// is emitted for the "coming soon" steps (external DB, OIDC) — no fake
// env vars for features that don't exist yet.

export function defaultComposeConfig() {
  return {
    port: "4000",
    dataVolume: "drydock-data",
    puid: "1000",
    pgid: "1000",
    dockerAccessMode: "socket", // "socket" | "proxy"
    dockerSocketPath: "/var/run/docker.sock",
    selinux: false,
    extraHostPath: "",
    extraContainerPath: "",
    logLevel: "info",
    logJson: false,
    jwtSecret: "",
    agentToken: "",
  };
}

function volSuffix(cfg) {
  return cfg.selinux ? ":Z" : "";
}

export function generateCompose(cfg) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push("services:");
  push("  drydock:");
  push("    build: .");
  push("    image: drydock:latest");
  push("    container_name: drydock");
  push("    restart: unless-stopped");
  push("    ports:");
  push(`      - "${cfg.port}:${cfg.port}"`);
  push("    environment:");
  push(`      - PORT=${cfg.port}`);
  if (cfg.puid) push(`      - PUID=${cfg.puid}`);
  if (cfg.pgid) push(`      - PGID=${cfg.pgid}`);
  push(`      - LOG_LEVEL=${cfg.logLevel}`);
  push(`      - LOG_JSON=${cfg.logJson}`);
  if (cfg.jwtSecret) push(`      - JWT_SECRET=${cfg.jwtSecret}`);
  if (cfg.agentToken) push(`      - AGENT_TOKEN=${cfg.agentToken}`);
  if (cfg.dockerAccessMode === "proxy") {
    push("      - DOCKER_HOST=tcp://docker-socket-proxy:2375");
  } else if (cfg.dockerSocketPath !== "/var/run/docker.sock") {
    push(`      - DOCKER_SOCKET_PATH=${cfg.dockerSocketPath}`);
  }
  push("    volumes:");
  push(`      - ${cfg.dataVolume}:/app/server/data${volSuffix(cfg)}`);
  if (cfg.dockerAccessMode === "socket") {
    push(`      - ${cfg.dockerSocketPath}:/var/run/docker.sock${volSuffix(cfg)}`);
  }
  if (cfg.extraHostPath && cfg.extraContainerPath) {
    push(`      - ${cfg.extraHostPath}:${cfg.extraContainerPath}${volSuffix(cfg)}`);
  }
  if (cfg.dockerAccessMode === "proxy") {
    push("    depends_on:");
    push("      - docker-socket-proxy");
    push();
    push("  docker-socket-proxy:");
    push("    image: tecnativa/docker-socket-proxy:latest");
    push("    container_name: drydock-socket-proxy");
    push("    restart: unless-stopped");
    push("    environment:");
    push("      - CONTAINERS=1");
    push("      - IMAGES=1");
    push("      - POST=1");
    push("    volumes:");
    push(`      - ${cfg.dockerSocketPath}:/var/run/docker.sock:ro`);
  }
  push();
  push("volumes:");
  push(`  ${cfg.dataVolume}:`);
  push();

  return lines.join("\n");
}
