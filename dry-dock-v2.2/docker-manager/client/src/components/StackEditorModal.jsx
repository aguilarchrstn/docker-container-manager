import { useState } from "react";
import { createStack, updateStack } from "../api.js";

const TEMPLATE = `services:
  app:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;

export default function StackEditorModal({ stack, onClose, onSaved }) {
  const isEdit = !!stack;
  const [name, setName] = useState(stack?.name || "");
  const [compose, setCompose] = useState(stack?.compose ?? TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit && !/^[a-z0-9][a-z0-9-]{0,50}$/.test(name)) {
      setError("Name must be lowercase letters, numbers, and hyphens only.");
      return;
    }
    if (!compose.trim()) {
      setError("Compose content is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setOutput(null);
    try {
      const result = isEdit
        ? await updateStack(stack.id, { compose })
        : await createStack({ name, compose });
      setOutput({ ok: true, stdout: result.stdout, stderr: result.stderr });
      onSaved();
    } catch (err) {
      setOutput({ ok: false, stderr: err.message });
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(760px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? `Edit "${stack.name}"` : "New stack"}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <form className="form-body" onSubmit={handleSubmit}>
          {error && <div className="banner error">{error}</div>}

          {!isEdit && (
            <label className="form-label">
              Stack name *
              <span className="field-hint">
                Used as the Compose project name — lowercase letters, numbers, and hyphens only.
              </span>
              <input
                className="form-input mono"
                placeholder="my-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
          )}

          <label className="form-label">
            docker-compose.yml
            <textarea
              className="form-input mono compose-editor"
              rows={16}
              spellCheck={false}
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
            />
          </label>

          {output && (
            <pre className={`logs-body ${output.ok ? "" : "error"}`} style={{ maxHeight: 180 }}>
              {output.stdout || output.stderr || "(no output)"}
            </pre>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
            {saving ? "Deploying…" : isEdit ? "Save & redeploy" : "Deploy stack"}
          </button>
        </form>
      </div>
    </div>
  );
}
