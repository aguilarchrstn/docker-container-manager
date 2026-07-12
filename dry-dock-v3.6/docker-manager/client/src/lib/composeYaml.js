// Every field here maps to something Dry Dock's server actually reads
// (see server/lib/docker.js, auth.js, logger.js, db.js). Nothing is
// emitted for the "coming soon" steps (OIDC) — no fake env vars for
// features that don't exist yet. (PUID/PGID were removed after the
// entrypoint script that consumed them caused container startup
// failures — reverted rather than left half-working.)

export function defaultComposeConfig() {
  return {
    appUrl: "http://localhost:4000",
    port: "4000",
    dataVolume: "drydock-data",
    dockerAccessMode: "socket", // "socket" | "proxy"
    dockerSocketPath: "/var/run/docker.sock",
    selinux: false,
    extraHostPath: "",
    extraContainerPath: "",
    logLevel: "info",
    logJson: false,
    encryptionKey: "",
    jwtSecret: "",
    agentToken: "",
    usePostgres: false,
    pgDatabase: "drydock",
    pgUser: "drydock",
    pgPassword: "",
    pgPort: "5432",
  };
}

function volSuffix(cfg) {
  return cfg.selinux ? ":Z" : "";
}

export function generateCompose(cfg) {
  const lines = [];
  const push = (s = "") => lines.push(s);
  const dependsOn = [];

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
  push(`      - LOG_LEVEL=${cfg.logLevel}`);
  push(`      - LOG_JSON=${cfg.logJson}`);
  if (cfg.jwtSecret) push(`      - JWT_SECRET=${cfg.jwtSecret}`);
  if (cfg.agentToken) push(`      - AGENT_TOKEN=${cfg.agentToken}`);
  if (cfg.encryptionKey) push(`      - ENCRYPTION_KEY=${cfg.encryptionKey}`);
  if (cfg.dockerAccessMode === "proxy") {
    push("      - DOCKER_HOST=tcp://docker-socket-proxy:2375");
  } else if (cfg.dockerSocketPath !== "/var/run/docker.sock") {
    push(`      - DOCKER_SOCKET_PATH=${cfg.dockerSocketPath}`);
  }
  if (cfg.usePostgres) {
    const user = cfg.pgUser || "drydock";
    const pass = cfg.pgPassword || "changeme";
    const db = cfg.pgDatabase || "drydock";
    const port = cfg.pgPort || "5432";
    push(`      - DATABASE_URL=postgresql://${user}:${pass}@postgres:${port}/${db}`);
  }
  push("    volumes:");
  if (!cfg.usePostgres) {
    // Users/roles/environments/theme/etc. live in this volume when using
    // the default JSON-file storage. Once Postgres is enabled they live in
    // the database instead, so this mount would just sit empty — omitted
    // to avoid implying it still matters.
    push(`      - ${cfg.dataVolume}:/app/server/data${volSuffix(cfg)}`);
  }
  if (cfg.dockerAccessMode === "socket") {
    push(`      - ${cfg.dockerSocketPath}:/var/run/docker.sock${volSuffix(cfg)}`);
  }
  if (cfg.extraHostPath && cfg.extraContainerPath) {
    push(`      - ${cfg.extraHostPath}:${cfg.extraContainerPath}${volSuffix(cfg)}`);
  }
  if (cfg.dockerAccessMode === "proxy") dependsOn.push({ name: "docker-socket-proxy", condition: "service_started" });
  if (cfg.usePostgres) dependsOn.push({ name: "postgres", condition: "service_healthy" });
  if (dependsOn.length) {
    push("    depends_on:");
    for (const dep of dependsOn) {
      push(`      ${dep.name}:`);
      push(`        condition: ${dep.condition}`);
    }
  }

  if (cfg.dockerAccessMode === "proxy") {
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

  if (cfg.usePostgres) {
    push();
    push("  postgres:");
    push("    image: postgres:16-alpine");
    push("    container_name: drydock-postgres");
    push("    restart: unless-stopped");
    push("    environment:");
    push(`      - POSTGRES_DB=${cfg.pgDatabase || "drydock"}`);
    push(`      - POSTGRES_USER=${cfg.pgUser || "drydock"}`);
    push(`      - POSTGRES_PASSWORD=${cfg.pgPassword || "changeme"}`);
    push("    volumes:");
    push("      - drydock-pgdata:/var/lib/postgresql/data");
    push("    healthcheck:");
    push(`      test: ["CMD-SHELL", "pg_isready -U ${cfg.pgUser || "drydock"} -d ${cfg.pgDatabase || "drydock"}"]`);
    push("      interval: 5s");
    push("      timeout: 5s");
    push("      retries: 10");
  }

  push();
  push("volumes:");
  if (!cfg.usePostgres) push(`  ${cfg.dataVolume}:`);
  if (cfg.usePostgres) push("  drydock-pgdata:");
  push();

  return lines.join("\n");
}
