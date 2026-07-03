// Mirrors server/lib/rbac.js's PERMISSIONS keys — kept as plain strings on
// both sides rather than shared across the client/server boundary.
export const PERMISSIONS = {
  CONTAINERS_VIEW: "containers.view",
  CONTAINERS_MANAGE: "containers.manage",
  IMAGES_VIEW: "images.view",
  IMAGES_MANAGE: "images.manage",
  ENVIRONMENTS_VIEW: "environments.view",
  ENVIRONMENTS_MANAGE: "environments.manage",
  APPEARANCE_MANAGE: "appearance.manage",
  USERS_MANAGE: "users.manage",
  TEAMS_MANAGE: "teams.manage",
  ROLES_MANAGE: "roles.manage",
};
