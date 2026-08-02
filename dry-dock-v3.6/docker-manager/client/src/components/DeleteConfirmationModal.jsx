import { useState } from "react";

export default function DeleteConfirmationModal({ containers, onConfirm, onClose }) {
  const [typedText, setTypedText] = useState("");

  const match = typedText.trim() === "delete me";

  function handleSubmit(e) {
    e.preventDefault();
    if (match) {
      onConfirm();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
        <div className="modal-header">
          <h2>Confirm Container Removal</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px 24px" }}>
            <p style={{ margin: "0 0 12px 0", color: "var(--color-danger)", fontWeight: "600" }}>
              ⚠️ Warning: This action cannot be undone!
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "var(--color-textMuted)" }}>
              You are about to delete the following container(s). A fail-safe backup will automatically be saved to the Backup Stack.
            </p>

            <div style={{
              background: "var(--color-surfaceRaised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              maxHeight: 120,
              overflowY: "auto",
              marginBottom: 20,
              fontSize: 13,
              fontFamily: "var(--font-mono)"
            }}>
              {containers.map((c) => (
                <div key={c.id} style={{ padding: "4px 0" }}>
                  • {c.name} <span style={{ color: "var(--color-textMuted)", fontSize: 11 }}>({c.image})</span>
                </div>
              ))}
            </div>

            <label className="form-label" style={{ marginBottom: 0 }}>
              To proceed, please type <span style={{ color: "var(--color-danger)", fontWeight: "bold" }}>delete me</span> below:
              <input
                type="text"
                className="form-input"
                style={{ marginTop: 8, borderColor: match ? "var(--color-success)" : "var(--color-border)" }}
                placeholder='Type "delete me"'
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </label>
          </div>
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={!match}
            >
              Confirm Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
