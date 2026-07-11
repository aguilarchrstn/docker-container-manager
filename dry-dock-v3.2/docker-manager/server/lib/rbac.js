// Central permission catalogue. Every permission-gated route checks one of
// these keys against the caller's *effective* permission set — the union of
// permissions from every role assigned directly to the user or to any team
// the user belongs to.

export const PERMISSIONS = {
  // Docker resources (containers/images/monitoring), scoped per-environment
  // at the route level via ?env=<id> — the permission itself is global
  // ("can operate containers"), not per-node.
  CONTAINERS_VIEW: "containers.view",
  CONTAINERS_MANAGE: "containers.manage", // start/stop/restart/pause/kill/create/remove
  IMAGES_VIEW: "images.view",
  IMAGES_MANAGE: "images.manage", // pull/remove
  STACKS_VIEW: "stacks.view",
  STACKS_MANAGE: "stacks.manage", // deploy/update/start/stop/remove
  VOLUMES_VIEW: "volumes.view",
  VOLUMES_MANAGE: "volumes.manage", // create/remove
  NETWORKS_VIEW: "networks.view",
  NETWORKS_MANAGE: "networks.manage", // create/remove

  // Environments (nodes)
  ENVIRONMENTS_VIEW: "environments.view",
  ENVIRONMENTS_MANAGE: "environments.manage", // add/edit/remove/test nodes

  // Appearance
  APPEARANCE_MANAGE: "appearance.manage",

  // Access control / governance
  USERS_MANAGE: "users.manage",
  TEAMS_MANAGE: "teams.manage",
  ROLES_MANAGE: "roles.manage",

  // Activity log / notifications / app settings
  ACTIVITY_VIEW: "activity.view",
  ACTIVITY_MANAGE: "activity.manage", // clear the log
  SETTINGS_MANAGE: "settings.manage",
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Built-in roles seeded on first boot. `builtin: true` roles can't be
// deleted (Administrator must always exist), but Administrator's
// permission list can still be inspected/edited like any other role.
export const DEFAULT_ROLES = [
  {
    id: "role-admin",
    name: "Administrator",
    description: "Full access to every environment and to access control.",
    builtin: true,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    id: "role-member",
    name: "Member",
    description: "Can view and operate containers/images/stacks on assigned environments.",
    builtin: true,
    permissions: [
      PERMISSIONS.CONTAINERS_VIEW,
      PERMISSIONS.CONTAINERS_MANAGE,
      PERMISSIONS.IMAGES_VIEW,
      PERMISSIONS.IMAGES_MANAGE,
      PERMISSIONS.STACKS_VIEW,
      PERMISSIONS.STACKS_MANAGE,
      PERMISSIONS.VOLUMES_VIEW,
      PERMISSIONS.VOLUMES_MANAGE,
      PERMISSIONS.NETWORKS_VIEW,
      PERMISSIONS.NETWORKS_MANAGE,
      PERMISSIONS.ENVIRONMENTS_VIEW,
      PERMISSIONS.ACTIVITY_VIEW,
    ],
  },
  {
    id: "role-viewer",
    name: "Viewer",
    description: "Read-only access — can see containers, images, stacks, and dashboards.",
    builtin: true,
    permissions: [
      PERMISSIONS.CONTAINERS_VIEW,
      PERMISSIONS.IMAGES_VIEW,
      PERMISSIONS.STACKS_VIEW,
      PERMISSIONS.VOLUMES_VIEW,
      PERMISSIONS.NETWORKS_VIEW,
      PERMISSIONS.ENVIRONMENTS_VIEW,
      PERMISSIONS.ACTIVITY_VIEW,
    ],
  },
];

// Computes the union of permissions across a user's direct roles plus the
// roles of every team they belong to.
export function effectivePermissions(user, teams, roles) {
  const roleIds = new Set(user.roleIds || []);
  for (const team of teams) {
    if (team.memberIds?.includes(user.id)) {
      for (const rid of team.roleIds || []) roleIds.add(rid);
    }
  }
  const perms = new Set();
  for (const rid of roleIds) {
    const role = roles.find((r) => r.id === rid);
    if (role) for (const p of role.permissions || []) perms.add(p);
  }
  return perms;
}

export function hasPermission(effectiveSet, permission) {
  return effectiveSet.has(permission);
}
