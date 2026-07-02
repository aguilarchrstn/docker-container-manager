import { useState } from "react";
import { createEnvironment, testEnvironment } from "../api.js";

const KINDS = [
  { value: "local", label: "Local Docker socket", ready: true, desc: "The Docker Engine on this host, via /var/run/docker.sock." },
  { value: "tcp", label: "Remote Docker over TCP", ready: false, desc: "Another host exposing dockerd over TCP (with TLS)." },
  { value: "ssh", label: "Docker over SSH", ready: false, desc: "ssh://user@host — no daemon exposure needed." },
  { value: "remote_node", label: "Remote Dry Dock node", ready: false, desc: "Federate to another Dry Dock instance via its API." },
];

export default function EnvironmentWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("local");
  const [config, setConfig] = useState({ socketPath: "/var/run/docker.sock" });
  const [isDefault, setIsDefault] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function pickKind(k) {
    setKind(k);
    setTestResult(null);
    if (k === "local") setConfig({ socketPath: "/var/run/docker.sock" });
    if (k === "tcp") setConfig({ host: "", port: 2375, tls: false });
    if (k === "ssh") setConfig({ host: "", port: 22, username: "root" });
    if (k === "remote_node") setConfig({ url: "", token: "" });
  }

  async function runTest() {
    setTesting(true); setTestResult(null);
    try {
      const r = await testEnvironment({ kind, config });
      setTestResult(r);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      await createEnvironment({ name: name.trim(), kind, config, isDefault });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const kindDef = KINDS.find((k) => k.value === kind);
  const canNextFromStep2 = kindDef?.ready;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="wizard-step">Step {step} of 4</div>
            <h3>Add environment</h3>
          </div>
          <button className="icon" onClick={onClose}>×</button>
        </div>

        <div className="wizard-body">
          {step === 1 && (
            <>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production node A" autoFocus />
              <p className="hint">A short label that will appear in the environment switcher.</p>
            </>
          )}

          {step === 2 && (
            <div className="kind-list">
              {KINDS.map((k) => (
                <label key={k.value} className={`kind-option ${!k.ready ? "disabled" : ""} ${kind === k.value ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === k.value}
                    onChange={() => pickKind(k.value)}
                  />
                  <div>
                    <div className="kind-title">
                      {k.label}
                      {!k.ready && <span className="tag">coming soon</span>}
                    </div>
                    <div className="kind-desc">{k.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <>
              {kind === "local" && (
                <>
                  <label>Socket path</label>
                  <input
                    value={config.socketPath}
                    onChange={(e) => setConfig({ ...config, socketPath: e.target.value })}
                  />
                  <p className="hint">
                    The Dry Dock container must have this path mounted, e.g.
                    <code> -v /var/run/docker.sock:/var/run/docker.sock</code>.
                  </p>
                </>
              )}
              {kind === "tcp" && (
                <>
                  <label>Host</label>
                  <input value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} placeholder="node-a.internal" />
                  <label>Port</label>
                  <input type="number" value={config.port} onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })} />
                  <label>
                    <input type="checkbox" checked={!!config.tls} onChange={(e) => setConfig({ ...config, tls: e.target.checked })} /> Use TLS
                  </label>
                </>
              )}
              {kind === "ssh" && (
                <>
                  <label>Host</label>
                  <input value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} />
                  <label>Port</label>
                  <input type="number" value={config.port} onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })} />
                  <label>Username</label>
                  <input value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} />
                </>
              )}
              {kind === "remote_node" && (
                <>
                  <label>Remote URL</label>
                  <input value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} placeholder="https://drydock-b.example.com" />
                  <label>API token</label>
                  <input value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} />
                </>
              )}
              <div className="test-row">
                <button onClick={runTest} disabled={testing}>{testing ? "Testing…" : "Test connection"}</button>
                {testResult && (
                  <span className={testResult.ok ? "ok" : "err"}>
                    {testResult.ok
                      ? `Connected — Docker ${testResult.serverVersion} on ${testResult.os}`
                      : `Failed: ${testResult.error}`}
                  </span>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="review">
                <div><b>Name:</b> {name}</div>
                <div><b>Type:</b> {kindDef?.label}</div>
                <div><b>Config:</b> <code>{JSON.stringify(config)}</code></div>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Set as default environment
              </label>
              {error && <div className="login-error">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button onClick={() => setStep(step - 1)}>Back</button>}
          <div style={{ flex: 1 }} />
          {step < 4 && (
            <button
              className="primary"
              disabled={
                (step === 1 && !name.trim()) ||
                (step === 2 && !canNextFromStep2)
              }
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          )}
          {step === 4 && (
            <button className="primary" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : "Create environment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
