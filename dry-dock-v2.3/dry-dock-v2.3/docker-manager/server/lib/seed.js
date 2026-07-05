import { readCollection, writeCollection } from "./store.js";
import { hashPassword, newId } from "./auth.js";
import { DEFAULT_ROLES } from "./rbac.js";

// Runs on every boot; each step is a no-op once its collection already has
// data, so it's safe to call repeatedly (e.g. across container restarts).
export async function seedDefaults() {
  await seedRoles();
  await seedAdminUser();
  await seedTeams();
  await seedEnvironments();
}

async function seedRoles() {
  const roles = await readCollection("roles", []);
  if (roles.length) return;
  await writeCollection("roles", DEFAULT_ROLES);
}

async function seedAdminUser() {
  const users = await readCollection("users", []);
  if (users.length) return;
  const passwordHash = await hashPassword("admin");
  const admin = {
    id: newId("user"),
    username: "admin",
    displayName: "Administrator",
    passwordHash,
    roleIds: ["role-admin"],
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  await writeCollection("users", [admin]);
}

async function seedTeams() {
  const teams = await readCollection("teams", []);
  if (teams.length) return;
  const users = await readCollection("users", []);
  const admin = users.find((u) => u.username === "admin");
  await writeCollection("teams", [
    {
      id: newId("team"),
      name: "Everyone",
      description: "Default team — all new users are added here automatically.",
      memberIds: admin ? [admin.id] : [],
      roleIds: [],
      builtin: true,
    },
  ]);
}

async function seedEnvironments() {
  const environments = await readCollection("environments", []);
  if (environments.length) return;
  await writeCollection("environments", [
    {
      id: "local",
      name: "This host",
      description: "The Docker Engine Dry Dock is running alongside (local socket).",
      type: "local",
      builtin: true,
      config: {},
      createdAt: new Date().toISOString(),
    },
  ]);
}
