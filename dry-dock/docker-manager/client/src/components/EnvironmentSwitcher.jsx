import { useEffect, useState } from "react";
import { listEnvironments, setCurrentEnvironment, getCurrentEnvironment } from "../api.js";

export default function EnvironmentSwitcher({ onChange }) {
  const [environments, setEnvironments] = useState([]);
  const [current, setCurrent] = useState(getCurrentEnvironment());

  useEffect(() => {
    listEnvironments()
      .then(setEnvironments)
      .catch(() => {});
  }, []);

  function handleChange(e) {
    const id = e.target.value;
    setCurrent(id);
    setCurrentEnvironment(id);
    onChange?.(id);
  }

  if (environments.length <= 1) return null;

  return (
    <select className="env-switcher" value={current} onChange={handleChange}>
      {environments.map((env) => (
        <option key={env.id} value={env.id}>
          {env.name}
        </option>
      ))}
    </select>
  );
}
