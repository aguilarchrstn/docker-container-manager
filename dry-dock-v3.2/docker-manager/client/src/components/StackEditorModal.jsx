import { useState } from "react";
import { createStack, updateStack, testStack } from "../api.js";

const TEMPLATE = `services:
  app:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,50}$/;

export default function StackEditorModal({ stack, onClose, onSaved }) {
  const isEdit = !!stack;
  const [name, setName] = useState(stack?.name || "");
  const [compose, setCompose] = useState(stack?.compose ?? TEMPLATE);
  const [saving, setSaving] = useState(null); // null | "test" | "save" | "deploy"
  const [error, setError] = useState(null);
  const [output, setOutput] = useState(null);

  function validateForm() {
    if (!isEdit && !NAME_RE.test(name)) {
      setError("Name must be lowercase letters, numbers, and hyphens only.");
      return false;
    }
    if (!compose.trim()) {
      setError("Compose content is required.");
      return false;
    }
    return true;
  }

  async function handleTest() {
    if (!validateForm()) return;
    setSaving("test");
    setError(null);
    setOutput(null);
    try {
      const result = await testStack(compose);
      setOutput(
        result.ok
          ? { ok: true, stdout: result.output || "Looks good — this compose file is valid." }
          : { ok: false, stderr: result.error }
      );
    } catch (err) {
      setOutput({ ok: false, stderr: err.message });
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmit(e, deploy) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(deploy ? "deploy" : "save");
    setError(null);
    setOutput(null);
    try {
      const result = isEdit
        ? await updateStack(stack.id, { compose })
        : await createStack({ name, compose, deploy });
      setOutput({ ok: true, stdout: result.stdout, stderr: result.stderr });
      onSaved();
    } catch (err) {
      setOutput({ ok: false, stderr: err.message });
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(760px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? `Edit "${stack.name}"` : "New stack"}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <form className="form-body" onSubmit={(e) => handleSubmit(e, true)}>
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

          <div className="flex-row">
            <button type="button" className="btn btn-ghost" onClick={handleTest} disabled={saving !== null}>
              {saving === "test" ? "Testing…" : "Test"}
            </button>
            <span className="field-hint">Validates the compose file without starting anything.</span>
            <span className="spacer" />
            {!isEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(e) => handleSubmit(e, false)}
                disabled={saving !== null}
              >
                {saving === "save" ? "Saving…" : "Save (don't deploy)"}
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={saving !== null}>
              {saving === "deploy" ? "Deploying…" : isEdit ? "Save & redeploy" : "Deploy stack"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
