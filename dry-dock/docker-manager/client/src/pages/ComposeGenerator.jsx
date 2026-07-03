import { useMemo, useState } from "react";

// Arcane-style Docker Compose generator. 7 guided steps.
const STEPS = [
  { key: "basic", label: "Basic", title: "Basic setup", subtitle: "Essential Arcane settings" },
  { key: "docker", label: "Docker Access", title: "Docker Access setup", subtitle: "Choose how Arcane talks to Docker." },
  { key: "storage", label: "Project Storage", title: "Project Storage setup", subtitle: "Optional host mount for your projects (compose) folder. It's recommended to have this match on both sides so relative paths work correctly." },
  { key: "runtime", label: "Runtime", title: "Runtime setup", subtitle: "Logging and runtime behavior" },
  { key: "security", label: "Security", title: "Security setup", subtitle: "Encryption and authentication secrets" },
  { key: "database", label: "Database", title: "Database setup", subtitle: "By default, Arcane uses SQLite. Enable this for external PostgreSQL." },
  { key: "auth", label: "Authentication", title: "Authentication setup", subtitle: "Single Sign-On configuration" },
];

const DEFAULTS = {
  appUrl: "http://localhost:3552",
  port: "3552",
  dataVolume: "arcane-data",
  puid: "1000",
  pgid: "1000",
  dockerSocket: "/var/run/docker.sock",
  useSocketProxy: false,
  selinux: false,
  projectsPath: "/opt/docker/projects",
  logLevel: "error",
  jsonLogging: false,
  encryptionKey: "",
  jwtSecret: "",
  usePostgres: false,
  pgHost: "postgres",
  pgPort: "5432",
  pgUser: "arcane",
  pgPassword: "",
  pgDatabase: "arcane",
  enableOidc: false,
  oidcIssuer: "",
  oidcClientId: "",
  oidcClientSecret: "",
  oidcRedirect: "",
};

function randHex(bytes) {
  const arr = new Uint8Array(bytes);
  (globalThis.crypto || window.crypto).getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildCompose(v) {
  const env = [];
  const push = (k, val) => { if (val !== "" && val !== undefined && val !== null) env.push(`      ${k}: ${JSON.stringify(String(val))}`); };
  push("APP_URL", v.appUrl);
  push("PORT", v.port);
  push("PUID", v.puid);
  push("PGID", v.pgid);
  push("LOG_LEVEL", v.logLevel);
  if (v.jsonLogging) push("LOG_JSON", "true");
  if (v.encryptionKey) push("ENCRYPTION_KEY", v.encryptionKey);
  if (v.jwtSecret) push("JWT_SECRET", v.jwtSecret);
  if (v.usePostgres) {
    push("DB_DRIVER", "postgres");
    push("POSTGRES_HOST", v.pgHost);
    push("POSTGRES_PORT", v.pgPort);
    push("POSTGRES_USER", v.pgUser);
    push("POSTGRES_PASSWORD", v.pgPassword);
    push("POSTGRES_DB", v.pgDatabase);
  }
  if (v.enableOidc) {
    push("OIDC_ENABLED", "true");
    push("OIDC_ISSUER", v.oidcIssuer);
    push("OIDC_CLIENT_ID", v.oidcClientId);
    push("OIDC_CLIENT_SECRET", v.oidcClientSecret);
    push("OIDC_REDIRECT_URI", v.oidcRedirect);
  }

  const volumes = [];
  if (v.useSocketProxy) {
    // socket proxy service handles docker access; app talks to it via tcp
    push("DOCKER_HOST", "tcp://socket-proxy:2375");
  } else {
    const suffix = v.selinux ? ":z" : "";
    volumes.push(`      - ${v.dockerSocket}:/var/run/docker.sock${suffix}`);
  }
  const dataSuffix = v.selinux ? ":z" : "";
  volumes.push(`      - ${v.dataVolume}:/app/data${dataSuffix}`);
  if (v.projectsPath) {
    volumes.push(`      - ${v.projectsPath}:${v.projectsPath}${dataSuffix}`);
    push("PROJECTS_DIR", v.projectsPath);
  }

  const services = [];
  services.push(`  arcane:
    image: ghcr.io/ofkm/arcane:latest
    container_name: arcane
    restart: unless-stopped
    ports:
      - "${v.port}:${v.port}"
    environment:
${env.join("\n") || "      {}"}
    volumes:
${volumes.join("\n")}`);

  if (v.useSocketProxy) {
    services.push(`  socket-proxy:
    image: ghcr.io/tecnativa/docker-socket-proxy:latest
    container_name: socket-proxy
    restart: unless-stopped
    environment:
      CONTAINERS: "1"
      IMAGES: "1"
      NETWORKS: "1"
      VOLUMES: "1"
      SERVICES: "1"
      TASKS: "1"
      POST: "1"
    volumes:
      - ${v.dockerSocket}:/var/run/docker.sock:ro`);
  }

  if (v.usePostgres) {
    services.push(`  postgres:
    image: postgres:16-alpine
    container_name: arcane-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${JSON.stringify(v.pgUser)}
      POSTGRES_PASSWORD: ${JSON.stringify(v.pgPassword)}
      POSTGRES_DB: ${JSON.stringify(v.pgDatabase)}
    volumes:
      - arcane-postgres:/var/lib/postgresql/data`);
  }

  const vols = [`  ${v.dataVolume}:`];
  if (v.usePostgres) vols.push("  arcane-postgres:");

  return `services:
${services.join("\n\n")}

volumes:
${vols.join("\n")}
`;
}

function Field({ label, hint, children }) {
  return (
    <div className="cg-field">
      <div className="cg-field-label">
        <div className="cg-field-title">{label}</div>
        {hint && <div className="cg-field-hint">{hint}</div>}
      </div>
      <div className="cg-field-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="cg-toggle">
      <div>
        <div className="cg-field-title">{label}</div>
        {hint && <div className="cg-field-hint">{hint}</div>}
      </div>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function ComposeGenerator() {
  const [values, setValues] = useState(DEFAULTS);
  const [stepIdx, setStepIdx] = useState(0);
  const [output, setOutput] = useState(null);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));
  const step = STEPS[stepIdx];

  const summary = useMemo(() => {
    switch (step.key) {
      case "basic":
        return [
          ["App URL", values.appUrl],
          ["Port", values.port],
          ["Data Volume", values.dataVolume],
          ["PUID (User ID)", values.puid],
          ["PGID (Group ID)", values.pgid],
        ];
      case "docker":
        return [["Docker Socket", values.useSocketProxy ? "via socket-proxy" : values.dockerSocket]];
      case "storage":
        return values.projectsPath ? [["Projects Path", values.projectsPath]] : [];
      case "runtime":
        return [["Log Level", values.logLevel], ["JSON Logs", values.jsonLogging ? "on" : "off"]];
      case "security":
        return [
          ["Encryption Key", values.encryptionKey ? "custom" : "auto"],
          ["JWT Secret", values.jwtSecret ? "custom" : "auto"],
        ];
      case "database":
        return [["Driver", values.usePostgres ? "PostgreSQL" : "SQLite"]];
      case "auth":
        return [["OIDC", values.enableOidc ? "enabled" : "disabled"]];
      default:
        return [];
    }
  }, [step, values]);

  const total = summary.length;
  const filled = summary.filter(([, val]) => val !== "" && val !== undefined && val !== null).length;

  function next() {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    else setOutput(buildCompose(values));
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  function download() {
    const blob = new Blob([output], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cg-wrap">
      <div className="cg-main">
        <div className="cg-header">
          <h1>Docker Compose Generator</h1>
          <div className="subtitle">
            Follow the guided steps to configure Arcane services, credentials, and storage. Your Compose file is updated in real time.
          </div>
          <div className="cg-header-actions">
            <button className="btn btn-ghost btn-sm">📖 Setup Guide</button>
            <button className="btn btn-ghost btn-sm">⚙ Environment Docs</button>
          </div>
        </div>

        <div className="cg-stepper">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              className={`cg-step ${i === stepIdx ? "active" : ""} ${i < stepIdx ? "done" : ""}`}
              onClick={() => setStepIdx(i)}
            >
              <span className="cg-step-num">{i + 1}</span>
              <span className="cg-step-label">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="cg-progress-label">Step {stepIdx + 1} of {STEPS.length}</div>
        <div className="cg-progress"><div style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>

        <h2 className="cg-section-title">{step.title}</h2>
        <div className="subtitle" style={{ marginBottom: 18 }}>{step.subtitle}</div>

        <div className="cg-panel">
          <div className="cg-panel-title">
            {step.key === "basic" && "Core Configuration"}
            {step.key === "docker" && "Docker Access"}
            {step.key === "storage" && "Project Storage"}
            {step.key === "runtime" && "Runtime"}
            {step.key === "security" && "Security"}
            {step.key === "database" && "Database Configuration"}
            {step.key === "auth" && "OIDC Authentication"}
          </div>
          <div className="cg-panel-sub">{step.subtitle}</div>

          {step.key === "basic" && (
            <>
              <Field label="App URL" hint="The URL arcane runs on">
                <input value={values.appUrl} onChange={(e) => set({ appUrl: e.target.value })} />
              </Field>
              <Field label="Port" hint="The port arcane should run on">
                <input value={values.port} onChange={(e) => set({ port: e.target.value })} />
              </Field>
              <Field label="Data Volume" hint="Docker volume name for persistent data">
                <input value={values.dataVolume} onChange={(e) => set({ dataVolume: e.target.value })} />
              </Field>
              <Field label="PUID (User ID)" hint="File owner user ID">
                <input value={values.puid} onChange={(e) => set({ puid: e.target.value })} />
              </Field>
              <Field label="PGID (Group ID)" hint="File owner group ID">
                <input value={values.pgid} onChange={(e) => set({ pgid: e.target.value })} />
              </Field>
            </>
          )}

          {step.key === "docker" && (
            <>
              <Field label="Docker Socket" hint="Docker daemon socket path (used only when not using a socket proxy)">
                <input value={values.dockerSocket} onChange={(e) => set({ dockerSocket: e.target.value })} />
              </Field>
              <Toggle
                label="Use Socket Proxy"
                hint="Use a Docker socket proxy container instead of mounting the Docker socket directly"
                checked={values.useSocketProxy}
                onChange={(v) => set({ useSocketProxy: v })}
              />
              <Toggle
                label="Enable SELinux compatibility"
                hint="Add SELinux-related compose settings for mounted paths and direct socket mode"
                checked={values.selinux}
                onChange={(v) => set({ selinux: v })}
              />
            </>
          )}

          {step.key === "storage" && (
            <Field label="Projects Host Path" hint="Optional absolute host path to mount as Arcane projects directory (for project storage)">
              <input value={values.projectsPath} onChange={(e) => set({ projectsPath: e.target.value })} />
            </Field>
          )}

          {step.key === "runtime" && (
            <>
              <Field label="Log Level" hint="Logging verbosity">
                <select value={values.logLevel} onChange={(e) => set({ logLevel: e.target.value })}>
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </Field>
              <Toggle
                label="JSON Logging"
                hint="Enable JSON formatted logs"
                checked={values.jsonLogging}
                onChange={(v) => set({ jsonLogging: v })}
              />
            </>
          )}

          {step.key === "security" && (
            <>
              <Field label="Encryption Key" hint="Encryption key for secure stored sensitive data (auto-generated if empty)">
                <div className="cg-input-row">
                  <input placeholder="Auto-generated if empty" value={values.encryptionKey} onChange={(e) => set({ encryptionKey: e.target.value })} />
                  <button className="btn btn-primary btn-sm" onClick={() => set({ encryptionKey: randHex(32) })}>Generate</button>
                </div>
              </Field>
              <Field label="JWT Secret" hint="Session secret (auto-generated if empty)">
                <div className="cg-input-row">
                  <input placeholder="Auto-generated if empty" value={values.jwtSecret} onChange={(e) => set({ jwtSecret: e.target.value })} />
                  <button className="btn btn-primary btn-sm" onClick={() => set({ jwtSecret: randHex(48) })}>Generate</button>
                </div>
              </Field>
            </>
          )}

          {step.key === "database" && (
            <>
              <Toggle
                label="Use external PostgreSQL database"
                checked={values.usePostgres}
                onChange={(v) => set({ usePostgres: v })}
              />
              {values.usePostgres && (
                <>
                  <Field label="Host"><input value={values.pgHost} onChange={(e) => set({ pgHost: e.target.value })} /></Field>
                  <Field label="Port"><input value={values.pgPort} onChange={(e) => set({ pgPort: e.target.value })} /></Field>
                  <Field label="User"><input value={values.pgUser} onChange={(e) => set({ pgUser: e.target.value })} /></Field>
                  <Field label="Password"><input type="password" value={values.pgPassword} onChange={(e) => set({ pgPassword: e.target.value })} /></Field>
                  <Field label="Database"><input value={values.pgDatabase} onChange={(e) => set({ pgDatabase: e.target.value })} /></Field>
                </>
              )}
            </>
          )}

          {step.key === "auth" && (
            <>
              <Toggle
                label="Enable OIDC Authentication"
                checked={values.enableOidc}
                onChange={(v) => set({ enableOidc: v })}
              />
              {values.enableOidc && (
                <>
                  <Field label="Issuer URL"><input value={values.oidcIssuer} onChange={(e) => set({ oidcIssuer: e.target.value })} /></Field>
                  <Field label="Client ID"><input value={values.oidcClientId} onChange={(e) => set({ oidcClientId: e.target.value })} /></Field>
                  <Field label="Client Secret"><input type="password" value={values.oidcClientSecret} onChange={(e) => set({ oidcClientSecret: e.target.value })} /></Field>
                  <Field label="Redirect URI"><input value={values.oidcRedirect} onChange={(e) => set({ oidcRedirect: e.target.value })} /></Field>
                </>
              )}
            </>
          )}
        </div>

        {output && (
          <div className="cg-output">
            <div className="cg-output-header">
              <div className="cg-panel-title">docker-compose.yml</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(output)}>Copy</button>
                <button className="btn btn-primary btn-sm" onClick={download}>Download</button>
              </div>
            </div>
            <pre>{output}</pre>
          </div>
        )}
      </div>

      <aside className="cg-side">
        <div className="cg-side-card">
          <div className="cg-side-title">CURRENT STEP SUMMARY</div>
          <div className="cg-side-sub">Review key choices before continuing.</div>
          {summary.length === 0 ? (
            <div className="cg-side-empty">Make a selection in this step to see it summarized here.</div>
          ) : (
            <div className="cg-side-list">
              {summary.map(([k, v]) => (
                <div className="cg-side-row" key={k}>
                  <span>{k}</span>
                  <strong>{v || "—"}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="cg-side-row" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <span>Completion</span>
            <strong>{filled}/{total || 0}</strong>
          </div>
        </div>

        <div className="cg-side-actions">
          <button className="btn btn-ghost" onClick={back} disabled={stepIdx === 0}>‹ Back</button>
          <button className="btn btn-primary" onClick={next}>
            {stepIdx === STEPS.length - 1 ? "📄 Generate Docker Compose" : `${STEPS[stepIdx + 1].label} ›`}
          </button>
        </div>
      </aside>
    </div>
  );
}
