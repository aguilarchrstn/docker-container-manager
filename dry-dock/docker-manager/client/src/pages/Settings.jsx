import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext.jsx";
import { presets as builtinPresets, colorFields } from "../theme/presets.js";
import { generateRandomTheme } from "../theme/random.js";
import ColorField from "../components/ColorField.jsx";
import {
  listCustomPresets,
  createCustomPreset,
  deleteCustomPreset,
} from "../api.js";

const PREVIEW_KEYS = ["sidebarBg", "bg", "primary", "accent", "surfaceRaised"];

function PresetSwatches({ colors }) {
  return (
    <div className="preset-swatches">
      {PREVIEW_KEYS.map((key) => (
        <span key={key} className="preset-swatch" style={{ background: colors[key] }} />
      ))}
    </div>
  );
}

export default function Settings() {
  const { theme, updateTheme, persistTheme } = useTheme();
  const [draft, setDraft] = useState(theme);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customPresets, setCustomPresets] = useState([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetError, setPresetError] = useState(null);

  useEffect(() => setDraft(theme), [theme]);

  useEffect(() => {
    listCustomPresets()
      .then(setCustomPresets)
      .catch(() => {})
      .finally(() => setLoadingCustom(false));
  }, []);

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

  function handleRandomize() {
    const random = generateRandomTheme();
    setDraft(random);
    updateTheme(random);
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

  async function handleSavePreset(e) {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    setSavingPreset(true);
    setPresetError(null);
    try {
      const preset = await createCustomPreset({
        name: newPresetName.trim(),
        colors: draft.colors,
      });
      setCustomPresets((prev) => [...prev, preset]);
      setNewPresetName("");
      setShowSaveForm(false);
    } catch (err) {
      setPresetError(err.message);
    } finally {
      setSavingPreset(false);
    }
  }

  async function handleDeletePreset(id) {
    if (!confirm("Delete this custom preset?")) return;
    try {
      await deleteCustomPreset(id);
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setPresetError(err.message);
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
        <button className="btn btn-sm" onClick={handleRandomize}>
          🎲 Randomize
        </button>
      </div>
      <p className="status-label" style={{ marginBottom: 20 }}>
        Built-in presets are fixed starting points. Tweak any color or hit
        Randomize, then save your own version as a custom preset — changes
        preview instantly either way.
      </p>

      <div className="settings-grid">
        <div>
          <div className="color-field-group">
            <h3>Presets</h3>
            <div className="preset-list">
              {builtinPresets.map((preset) => (
                <button
                  key={preset.name}
                  className={`preset-card ${draft.name === preset.name ? "active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  <PresetSwatches colors={preset.colors} />
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-lock" title="Built-in — not editable">🔒</span>
                </button>
              ))}
            </div>
          </div>

          <div className="color-field-group">
            <h3>Your presets</h3>
            {presetError && <div className="banner error">{presetError}</div>}
            {loadingCustom ? (
              <p className="status-label">Loading…</p>
            ) : (
              <div className="preset-list">
                {customPresets.length === 0 && !showSaveForm && (
                  <p className="status-label" style={{ marginBottom: 8 }}>
                    No custom presets yet.
                  </p>
                )}
                {customPresets.map((preset) => (
                  <div key={preset.id} className="preset-card">
                    <button
                      className="preset-card-main"
                      onClick={() => applyPreset(preset)}
                      style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}
                    >
                      <PresetSwatches colors={preset.colors} />
                      <span className="preset-name">{preset.name}</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeletePreset(preset.id)}
                      title="Delete preset"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showSaveForm ? (
              <form onSubmit={handleSavePreset} style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <input
                  className="form-input"
                  placeholder="Preset name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="btn btn-sm btn-primary" type="submit" disabled={savingPreset}>
                  {savingPreset ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setShowSaveForm(false); setNewPresetName(""); }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                className="btn btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setShowSaveForm(true)}
              >
                + Save current as preset
              </button>
            )}
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
