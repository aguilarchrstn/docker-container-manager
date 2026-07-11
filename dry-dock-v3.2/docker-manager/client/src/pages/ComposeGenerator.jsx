import { useMemo, useState } from "react";
import { defaultComposeConfig, generateCompose } from "../lib/composeYaml.js";

function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

const STEPS = ["Basic", "Docker Access", "Project Storage", "Runtime", "Security", "Database", "Authentication"];

export default function ComposeGenerator() {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState(defaultComposeConfig());
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const yaml = useMemo(() => generateCompose(cfg), [cfg]);

  function set(field, value) {
    setCfg((c) => ({ ...c, [field]: value }));
  }

  function handleCopy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDownload() {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (generated) {
    return (
      <div>
        <div className="section-heading">
          <h2>Your docker-compose.yml</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setGenerated(false)}>
              ← Back to wizard
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleDownload}>
              Download
            </button>
          </div>
        </div>
        <pre className="compose-preview">{yaml}</pre>
        <div className="field-hint" style={{ marginTop: 12 }}>
          Save this as <code>docker-compose.yml</code> next to Dry Dock's Dockerfile and run{" "}
          <code>docker compose up -d --build</code>.
          {cfg.dockerAccessMode === "socket" &&
            " You've chosen to mount the Docker socket directly — that grants root-equivalent host access, so only run this on networks/people you trust."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="compose-toolbar">
        <div className="field-hint">
          Follow the guided steps to configure Dry Dock's deployment, credentials, and storage. Your
          Compose file updates in real time.
        </div>
      </div>

      <div className="wizard-stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`wizard-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span className="wizard-step-dot">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <div className="wizard-progress">
        <div className="wizard-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="field-hint" style={{ margin: "8px 0 20px" }}>Step {step + 1} of {STEPS.length}</div>

      <div className="wizard-layout">
        <div className="form-section-card">
          {step === 0 && <BasicStep cfg={cfg} set={set} />}
          {step === 1 && <DockerAccessStep cfg={cfg} set={set} />}
          {step === 2 && <ProjectStorageStep cfg={cfg} set={set} />}
          {step === 3 && <RuntimeStep cfg={cfg} set={set} />}
          {step === 4 && <SecurityStep cfg={cfg} set={set} />}
          {step === 5 && <DatabaseStep cfg={cfg} set={set} />}
          {step === 6 && <AuthenticationStep />}

          <div className="flex-row" style={{ marginTop: 20 }}>
            <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
            <span className="spacer" />
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                {STEPS[step + 1]} →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setGenerated(true)}>
                Generate Docker Compose
              </button>
            )}
          </div>
        </div>

        <StepSummary cfg={cfg} step={step} />
      </div>
    </div>
  );
}

function StepSummary({ cfg, step }) {
  const rows = [];
  if (step >= 0) {
    rows.push(["App URL", cfg.appUrl], ["Port", cfg.port], ["Data volume", cfg.dataVolume]);
  }
  if (step >= 1) {
    rows.push(["Docker access", cfg.dockerAccessMode === "proxy" ? "Socket proxy" : "Direct socket"]);
  }
  if (step >= 2 && cfg.extraHostPath) {
    rows.push(["Extra mount", `${cfg.extraHostPath} → ${cfg.extraContainerPath}`]);
  }
  if (step >= 3) {
    rows.push(["Log level", cfg.logLevel]);
  }
  if (step >= 4) {
    rows.push(["Encryption key", cfg.encryptionKey ? "set" : "off"]);
    rows.push(["JWT secret", cfg.jwtSecret ? "set" : "auto-generated"]);
    rows.push(["Agent token", cfg.agentToken ? "set" : "auto-generated"]);
  }
  if (step >= 5) {
    rows.push(["Database", cfg.usePostgres ? `PostgreSQL (${cfg.pgDatabase || "drydock"})` : "JSON files (default)"]);
  }

  return (
    <div className="wizard-summary">
      <div className="wizard-summary-title">CURRENT STEP SUMMARY</div>
      <div className="field-hint" style={{ marginBottom: 12 }}>Review key choices before continuing.</div>
      {rows.map(([label, value]) => (
        <div className="wizard-summary-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function BasicStep({ cfg, set }) {
  return (
    <>
      <h3>Basic setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>Core deployment settings.</div>
      <label className="form-label">
        App URL
        <span className="field-hint">
          For your own reference (e.g. reverse proxy notes) — Dry Dock doesn't currently read this as an
          env var, so it's not emitted into the Compose file.
        </span>
        <input className="form-input mono" value={cfg.appUrl} onChange={(e) => set("appUrl", e.target.value)} />
      </label>
      <label className="form-label">
        Port
        <span className="field-hint">The port Dry Dock listens on and is published as.</span>
        <input className="form-input" value={cfg.port} onChange={(e) => set("port", e.target.value)} />
      </label>
      <label className="form-label">
        Data volume
        <span className="field-hint">Docker volume name for persistent data (users, roles, theme, environments).</span>
        <input className="form-input" value={cfg.dataVolume} onChange={(e) => set("dataVolume", e.target.value)} />
      </label>
    </>
  );
}

function DockerAccessStep({ cfg, set }) {
  return (
    <>
      <h3>Docker Access setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>Choose how Dry Dock talks to Docker.</div>
      <label className="form-label">
        Access mode
        <select className="form-input" value={cfg.dockerAccessMode} onChange={(e) => set("dockerAccessMode", e.target.value)}>
          <option value="socket">Mount the Docker socket directly</option>
          <option value="proxy">Use a Docker socket proxy container</option>
        </select>
      </label>
      <label className="form-label">
        Docker socket path
        <span className="field-hint">Path on the host, mounted into the container (or into the proxy, if enabled).</span>
        <input className="form-input mono" value={cfg.dockerSocketPath} onChange={(e) => set("dockerSocketPath", e.target.value)} />
      </label>
      <label className="form-checkbox">
        <input type="checkbox" checked={cfg.selinux} onChange={(e) => set("selinux", e.target.checked)} />
        Enable SELinux compatibility (adds <code>:Z</code> to mounted paths)
      </label>
      {cfg.dockerAccessMode === "proxy" && (
        <div className="field-hint" style={{ marginTop: 8 }}>
          Adds a <code>tecnativa/docker-socket-proxy</code> sidecar — Dry Dock talks to Docker over that
          instead of touching the socket directly, which limits blast radius if the app is ever compromised.
        </div>
      )}
    </>
  );
}

function ProjectStorageStep({ cfg, set }) {
  return (
    <>
      <h3>Project Storage setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>
        Optional host mount for troubleshooting, backups, or anything else you want reachable from inside
        the container. It's recommended to have this match on both sides so absolute paths stay predictable.
      </div>
      <label className="form-label">
        Host path
        <span className="field-hint">Optional absolute host path to mount.</span>
        <input className="form-input mono" placeholder="optional, e.g. /opt/drydock/extra" value={cfg.extraHostPath} onChange={(e) => set("extraHostPath", e.target.value)} />
      </label>
      <label className="form-label">
        Container path
        <input className="form-input mono" placeholder="e.g. /app/extra" value={cfg.extraContainerPath} onChange={(e) => set("extraContainerPath", e.target.value)} />
      </label>
    </>
  );
}

function RuntimeStep({ cfg, set }) {
  return (
    <>
      <h3>Runtime setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>Logging behavior.</div>
      <label className="form-label">
        Log level
        <select className="form-input" value={cfg.logLevel} onChange={(e) => set("logLevel", e.target.value)}>
          <option value="silent">silent</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
        </select>
      </label>
      <label className="form-checkbox">
        <input type="checkbox" checked={cfg.logJson} onChange={(e) => set("logJson", e.target.checked)} />
        JSON logging (structured, one line per log entry)
      </label>
    </>
  );
}

function SecurityStep({ cfg, set }) {
  return (
    <>
      <h3>Security setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>
        All three are auto-generated and persisted on first boot if left blank — only pin these if you need
        a predictable value (multi-replica deployments, provisioning several agents from one file).
      </div>
      <label className="form-label">
        Encryption key
        <span className="field-hint">
          Encrypts the JWT secret and agent token at rest, instead of storing them as plain JSON. Optional —
          leave blank to keep the current behavior (plaintext on disk/DB, same as always).
        </span>
        <div className="flex-row">
          <input className="form-input mono" placeholder="off — auto-generated secrets stay plaintext at rest" value={cfg.encryptionKey} onChange={(e) => set("encryptionKey", e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => set("encryptionKey", randomHex(32))}>
            Generate
          </button>
        </div>
      </label>
      <label className="form-label">
        JWT secret
        <span className="field-hint">Signs login sessions.</span>
        <div className="flex-row">
          <input className="form-input mono" placeholder="auto-generated if empty" value={cfg.jwtSecret} onChange={(e) => set("jwtSecret", e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => set("jwtSecret", randomHex(48))}>
            Generate
          </button>
        </div>
      </label>
      <label className="form-label">
        Agent token
        <span className="field-hint">Shared secret for remote nodes/agents that connect in.</span>
        <div className="flex-row">
          <input className="form-input mono" placeholder="auto-generated if empty" value={cfg.agentToken} onChange={(e) => set("agentToken", e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => set("agentToken", randomHex(24))}>
            Generate
          </button>
        </div>
      </label>
    </>
  );
}

function DatabaseStep({ cfg, set }) {
  return (
    <>
      <h3>Database setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>
        By default, Dry Dock stores its own data (users, roles, environments, theme, activity) as JSON
        files on the data volume from step 1. Enable this to use an external PostgreSQL database instead —
        useful for multi-replica deployments or if you'd rather back everything up as a normal SQL database.
      </div>
      <label className="form-checkbox">
        <input type="checkbox" checked={cfg.usePostgres} onChange={(e) => set("usePostgres", e.target.checked)} />
        Use external PostgreSQL database
      </label>

      {cfg.usePostgres && (
        <div className="form-section" style={{ marginTop: 12 }}>
          <label className="form-label">
            Database Name
            <input className="form-input mono" value={cfg.pgDatabase} onChange={(e) => set("pgDatabase", e.target.value)} />
          </label>
          <label className="form-label">
            Database User
            <input className="form-input mono" value={cfg.pgUser} onChange={(e) => set("pgUser", e.target.value)} />
          </label>
          <label className="form-label">
            Database Password
            <input
              className="form-input mono"
              type="password"
              placeholder="your_secure_password"
              value={cfg.pgPassword}
              onChange={(e) => set("pgPassword", e.target.value)}
            />
          </label>
          <label className="form-label">
            Database Port
            <input className="form-input mono" value={cfg.pgPort} onChange={(e) => set("pgPort", e.target.value)} />
          </label>
          <div className="field-hint" style={{ marginTop: 4 }}>
            This adds a <code>postgres</code> service to the Compose file and points Dry Dock at it via{" "}
            <code>DATABASE_URL</code> — nothing further to configure. Leave the password blank and Dry Dock
            will still run, but set a real one before you actually deploy this.
          </div>
        </div>
      )}
    </>
  );
}

function AuthenticationStep() {
  return (
    <>
      <h3>Authentication setup</h3>
      <div className="field-hint" style={{ marginBottom: 16 }}>
        Local username/password accounts with full role-based access control are built in (see Access
        Control in the sidebar) — nothing to configure here.
      </div>
      <label className="form-checkbox disabled">
        <input type="checkbox" disabled />
        OIDC / Single Sign-On — coming soon
      </label>
    </>
  );
}
