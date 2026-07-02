import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { presets, colorFields } from "../theme/presets.js";
import ColorField from "../components/ColorField.jsx";

const PREVIEW_KEYS = ["sidebarBg", "bg", "primary", "accent", "surfaceRaised"];

export default function Settings() {
  const { theme, updateTheme, persistTheme } = useTheme();
  const [draft, setDraft] = useState(theme);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(theme), [theme]);

  function applyPreset(preset) {
    setDraft(preset);
    updateTheme(preset); // live preview immediately
    setSaved(false);
  }

  function setColor(key, value) {
    const next = { ...draft, colors: { ...draft.colors, [key]: value } };
    setDraft(next);
    updateTheme(next);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await persistTheme(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const grouped = colorFields.reduce((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="section-heading">
        <h2>Appearance</h2>
      </div>
      <p className="status-label" style={{ marginBottom: 20 }}>
        Pick a preset or fine-tune each color. Changes preview instantly —
        save to keep them.
      </p>

      <div className="settings-grid">
        <div>
          <div className="color-field-group">
            <h3>Presets</h3>
            <div className="preset-list">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className={`preset-card ${draft.name === preset.name ? "active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  <div className="preset-swatches">
                    {PREVIEW_KEYS.map((key) => (
                      <span
                        key={key}
                        className="preset-swatch"
                        style={{ background: preset.colors[key] }}
                      />
                    ))}
                  </div>
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {Object.entries(grouped).map(([group, fields]) => (
            <div className="color-field-group" key={group}>
              <h3>{group}</h3>
              {fields.map((f) => (
                <ColorField
                  key={f.key}
                  label={f.label}
                  value={draft.colors[f.key]}
                  onChange={(value) => setColor(f.key, value)}
                />
              ))}
            </div>
          ))}

          <div className="save-bar">
            {!saved && <span className="status-label" style={{ alignSelf: "center" }}>Unsaved changes</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || saved}>
              {saving ? "Saving…" : "Save theme"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
