import { useEnvironment } from "../context/EnvironmentContext.jsx";
import { Spinner } from "./LoadingState.jsx";

export default function EnvironmentSwitcher() {
  const { environments, currentId, switching, selectEnvironment } = useEnvironment();

  if (environments.length <= 1) return null;

  return (
    <div className="sidebar-env-switcher-inner">
      <select
        className="env-switcher"
        value={currentId}
        onChange={(e) => selectEnvironment(e.target.value)}
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      {switching && (
        <span className="env-switching-badge">
          <Spinner size={13} />
          Switching…
        </span>
      )}
    </div>
  );
}
