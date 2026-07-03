import { useState } from "react";
import { createEnvironment, testEnvironmentConnection } from "../api.js";

const TYPES = [
  {
    key: "standalone",
    title: "Standalone Docker node",
    description:
      "Connect directly to another Docker Engine over TCP (or SSH-tunneled TCP) — a plain docker host with no manager running on it.",
  },
  {
    key: "agent",
    title: "Self-hosted Dry Dock manager",
    description:
      "Connect through another Dry Dock instance's API — useful when that node isn't directly reachable, or when it's itself managing a further server.",
  },
];

function emptyStandaloneConfig() {
  return { host: "", port: "2375", tls: false, ca: "", cert: "", key: "" };
}
function emptyAgentConfig() {
  return { baseUrl: "", agentToken: "", remoteEnvironmentId: "" };
}

export default function EnvironmentWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1); // 1 = pick type, 2 = configure
  const [type, setType] = useState("standalone");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [standaloneConfig, setStandaloneConfig] = useState(emptyStandaloneConfig());
  const [agentConfig, setAgentConfig] = useState(emptyAgentConfig());
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const config = type === "standalone" ? standaloneConfig : agentConfig;

  function updateStandalone(field, value) {
    setStandaloneConfig((c) => ({ ...c, [field]: value }));
    setTestResult(null);
  }
  function updateAgent(field, value) {
    setAgentConfig((c) => ({ ...c, [field]: value }));
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      const result = await testEnvironmentConnection(type, config);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this node a name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createEnvironment({ name: name.trim(), description, type, config });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(620px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add environment</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        {step === 1 && (
          <div className="form-body">
            <div className="field-hint" style={{ marginBottom: 4 }}>
              What are you connecting Dry Dock to?
            </div>
            <div className="wizard-type-grid">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  className={`wizard-type-card ${type === t.key ? "active" : ""}`}
                  onClick={() => setType(t.key)}
                >
                  <div className="wizard-type-title">{t.title}</div>
                  <div className="wizard-type-desc">{t.description}</div>
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-block" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSave} className="form-body">
            {error && <div className="banner error">{error}</div>}

            <label className="form-label">
              Name *
              <input
                className="form-input"
                placeholder={type === "standalone" ? "e.g. build-server-01" : "e.g. office rack via manager-2"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="form-label">
              Description
              <input
                className="form-input"
                placeholder="optional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {type === "standalone" ? (
              <>
                <div className="form-row">
                  <input
                    className="form-input mono"
                    placeholder="Host or IP, e.g. 10.0.0.12"
                    value={standaloneConfig.host}
                    onChange={(e) => updateStandalone("host", e.target.value)}
                  />
                  <span className="form-row-sep">:</span>
                  <input
                    className="form-input mono"
                    placeholder="Port"
                    value={standaloneConfig.port}
                    onChange={(e) => updateStandalone("port", e.target.value)}
                  />
                </div>
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={standaloneConfig.tls}
                    onChange={(e) => updateStandalone("tls", e.target.checked)}
                  />
                  Use TLS (recommended for anything beyond localhost)
                </label>
                {standaloneConfig.tls && (
                  <div className="form-section">
                    <label className="form-label">
                      CA certificate
                      <textarea
                        className="form-input mono"
                        rows={3}
                        value={standaloneConfig.ca}
                        onChange={(e) => updateStandalone("ca", e.target.value)}
                      />
                    </label>
                    <label className="form-label">
                      Client certificate
                      <textarea
                        className="form-input mono"
                        rows={3}
                        value={standaloneConfig.cert}
                        onChange={(e) => updateStandalone("cert", e.target.value)}
                      />
                    </label>
                    <label className="form-label">
                      Client key
                      <textarea
                        className="form-input mono"
                        rows={3}
                        value={standaloneConfig.key}
                        onChange={(e) => updateStandalone("key", e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <div className="field-hint">
                  The target's Docker daemon needs <code>-H tcp://0.0.0.0:{standaloneConfig.port || "2375"}</code>{" "}
                  enabled (or an SSH tunnel forwarded to that port). Unencrypted TCP should only be used on a
                  trusted private network.
                </div>
              </>
            ) : (
              <>
                <label className="form-label">
                  Manager base URL *
                  <input
                    className="form-input mono"
                    placeholder="https://other-drydock.example.com"
                    value={agentConfig.baseUrl}
                    onChange={(e) => updateAgent("baseUrl", e.target.value)}
                  />
                </label>
                <label className="form-label">
                  Agent token *
                  <input
                    className="form-input mono"
                    placeholder="from that instance's Environments → Agent token"
                    value={agentConfig.agentToken}
                    onChange={(e) => updateAgent("agentToken", e.target.value)}
                  />
                </label>
                <label className="form-label">
                  Remote environment id
                  <input
                    className="form-input mono"
                    placeholder="leave blank for that manager's own local node"
                    value={agentConfig.remoteEnvironmentId}
                    onChange={(e) => updateAgent("remoteEnvironmentId", e.target.value)}
                  />
                  <span className="field-hint">
                    Only needed to chain further — e.g. that manager already has a standalone node of its own
                    you want to reach through it.
                  </span>
                </label>
              </>
            )}

            {testResult && (
              <div className={`banner ${testResult.ok ? "" : "error"}`}>
                {testResult.ok
                  ? `Connected — Docker ${testResult.info?.serverVersion || testResult.info?.name || ""}`
                  : `Couldn't connect: ${testResult.error}`}
              </div>
            )}

            <div className="form-row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleTest} disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </button>
              <span className="spacer" />
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save environment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
