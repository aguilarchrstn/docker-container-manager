import { useEffect, useState } from "react";
import {
  listEnvironments, deleteEnvironment, updateEnvironment,
} from "../api.js";
import { useEnv } from "../env/EnvContext.jsx";
import EnvironmentWizard from "../components/EnvironmentWizard.jsx";

export default function Environments() {
  const { refresh: refreshEnvCtx, currentId, setCurrentId } = useEnv();
  const [envs, setEnvs] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  async function load() {
    setEnvs(await listEnvironments());
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(env) {
    if (!confirm(`Delete environment "${env.name}"?`)) return;
    try {
      await deleteEnvironment(env.id);
      await load();
      await refreshEnvCtx();
    } catch (err) { alert(err.message); }
  }

  async function makeDefault(env) {
    await updateEnvironment(env.id, { isDefault: true });
    await load();
    await refreshEnvCtx();
  }

  return (
    <div>
      <div className="page-actions">
        <button className="primary" onClick={() => setWizardOpen(true)}>+ Add environment</button>
      </div>

      <div className="env-list">
        {envs.map((e) => (
          <div key={e.id} className={`env-row ${currentId === e.id ? "active" : ""}`}>
            <div className="env-info">
              <div className="env-name">
                {e.name}
                {e.isDefault && <span className="tag">default</span>}
                {currentId === e.id && <span className="tag active">selected</span>}
              </div>
              <div className="env-meta">{describe(e)}</div>
            </div>
            <div className="env-actions">
              <button onClick={() => setCurrentId(e.id)}>Select</button>
              {!e.isDefault && <button onClick={() => makeDefault(e)}>Make default</button>}
              <button className="danger" onClick={() => handleDelete(e)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {wizardOpen && (
        <EnvironmentWizard
          onClose={() => setWizardOpen(false)}
          onCreated={async () => { setWizardOpen(false); await load(); await refreshEnvCtx(); }}
        />
      )}
    </div>
  );
}

function describe(e) {
  switch (e.kind) {
    case "local": return `Local socket · ${e.config.socketPath || "/var/run/docker.sock"}`;
    case "tcp": return `TCP · ${e.config.host}:${e.config.port || 2375}${e.config.tls ? " (TLS)" : ""}`;
    case "ssh": return `SSH · ${e.config.username}@${e.config.host}:${e.config.port || 22}`;
    case "remote_node": return `Remote node · ${e.config.url}`;
    default: return e.kind;
  }
}
