// Mirrors server/lib/rbac.js's PERMISSIONS keys — kept as plain strings on
// both sides rather than shared across the client/server boundary.
export const PERMISSIONS = {
  CONTAINERS_VIEW: "containers.view",
  CONTAINERS_MANAGE: "containers.manage",
  IMAGES_VIEW: "images.view",
  IMAGES_MANAGE: "images.manage",
  STACKS_VIEW: "stacks.view",
  STACKS_MANAGE: "stacks.manage",
  VOLUMES_VIEW: "volumes.view",
  VOLUMES_MANAGE: "volumes.manage",
  NETWORKS_VIEW: "networks.view",
  NETWORKS_MANAGE: "networks.manage",
  ENVIRONMENTS_VIEW: "environments.view",
  ENVIRONMENTS_MANAGE: "environments.manage",
  APPEARANCE_MANAGE: "appearance.manage",
  USERS_MANAGE: "users.manage",
  TEAMS_MANAGE: "teams.manage",
  ROLES_MANAGE: "roles.manage",
  ACTIVITY_VIEW: "activity.view",
  ACTIVITY_MANAGE: "activity.manage",
  SETTINGS_MANAGE: "settings.manage",
};
