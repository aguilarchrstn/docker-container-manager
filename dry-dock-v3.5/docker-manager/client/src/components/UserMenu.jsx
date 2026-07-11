import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import MyAccountModal from "./MyAccountModal.jsx";

function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;
  const label = user.displayName || user.username;

  return (
    <div className="user-menu-wrap" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="user-menu-avatar">{initials(label)}</span>
        <span className="user-menu-name">{label}</span>
        <span className="user-menu-chevron">▾</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <button
            className="user-menu-item"
            onClick={() => {
              setAccountOpen(true);
              setOpen(false);
            }}
          >
            My account
          </button>
          <button className="user-menu-item" onClick={logout}>
            Log out
          </button>
        </div>
      )}

      {accountOpen && <MyAccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
