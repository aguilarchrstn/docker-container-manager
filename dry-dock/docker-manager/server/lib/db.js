import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- Schema ------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,          -- 'local' | 'tcp' | 'ssh' | 'remote_node'
    config_json TEXT NOT NULL,   -- connection details
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

// --- Seed defaults -----------------------------------------------------------
const PERMISSIONS = [
  ["envs.read", "View environments"],
  ["envs.write", "Create / edit / delete environments"],
  ["containers.read", "View containers"],
  ["containers.write", "Start / stop / create / delete containers"],
  ["images.read", "View images"],
  ["images.write", "Pull / delete images"],
  ["appearance.write", "Change theme and presets"],
  ["admin", "Full administrative access (users, teams, roles)"],
];

const ROLES = {
  admin: { description: "Full access", perms: PERMISSIONS.map(([k]) => k) },
  editor: {
    description: "Operate environments (no user/role admin)",
    perms: [
      "envs.read", "envs.write",
      "containers.read", "containers.write",
      "images.read", "images.write",
      "appearance.write",
    ],
  },
  viewer: {
    description: "Read-only",
    perms: ["envs.read", "containers.read", "images.read"],
  },
};

const insertPerm = db.prepare(
  "INSERT OR IGNORE INTO permissions (id, key, description) VALUES (?, ?, ?)"
);
const findPerm = db.prepare("SELECT id FROM permissions WHERE key = ?");
for (const [key, desc] of PERMISSIONS) {
  insertPerm.run(randomUUID(), key, desc);
}

const insertRole = db.prepare(
  "INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, 1)"
);
const findRole = db.prepare("SELECT id FROM roles WHERE name = ?");
const insertRolePerm = db.prepare(
  "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)"
);
for (const [name, def] of Object.entries(ROLES)) {
  insertRole.run(randomUUID(), name, def.description);
  const roleId = findRole.get(name).id;
  for (const permKey of def.perms) {
    const p = findPerm.get(permKey);
    if (p) insertRolePerm.run(roleId, p.id);
  }
}

// Seed default admin user (admin/admin) on first run.
const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (userCount === 0) {
  const id = randomUUID();
  const hash = bcrypt.hashSync("admin", 10);
  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, disabled, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(id, "admin", hash, "Administrator", Date.now());
  const adminRoleId = findRole.get("admin").id;
  db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(id, adminRoleId);
  console.log("[dry-dock] Seeded default admin user (username: admin, password: admin) — CHANGE THIS!");
}

// Seed default local environment.
const envCount = db.prepare("SELECT COUNT(*) AS n FROM environments").get().n;
if (envCount === 0) {
  db.prepare(
    "INSERT INTO environments (id, name, kind, config_json, is_default, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  ).run(
    randomUUID(),
    "Local",
    "local",
    JSON.stringify({ socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock" }),
    Date.now()
  );
}

// --- Helpers -----------------------------------------------------------------
export function getUserPermissions(userId) {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.key FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`
    )
    .all(userId);
  return rows.map((r) => r.key);
}

export function getUserRoles(userId) {
  return db
    .prepare(
      `SELECT r.id, r.name, r.description FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`
    )
    .all(userId);
}

export function getFullUser(userId) {
  const u = db
    .prepare("SELECT id, username, display_name, disabled, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!u) return null;
  return {
    ...u,
    roles: getUserRoles(userId),
    permissions: getUserPermissions(userId),
  };
}
