export default function ColorField({ label, value, onChange }) {
  return (
    <div className="color-field-row">
      <label>{label}</label>
      <div className="color-field-control">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
