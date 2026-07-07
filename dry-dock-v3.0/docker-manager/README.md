# Dry Dock

A small self-hosted Docker container manager — think Portainer/Arcane, but
simple enough to actually read the code, and themeable the way Mattermost
lets you pick every UI color.

- **Backend:** Node.js + Express, talks to the Docker Engine via
  [dockerode](https://github.com/apocas/dockerode) over `/var/run/docker.sock`
  (or over TCP for remote nodes).
- **Frontend:** React + Vite, no CSS framework — just CSS variables so the
  theme picker can restyle the whole app live.
- **Features:**
  - **Login & access control**: session-based auth (JWT in an httpOnly
    cookie), with Users, Teams, and Roles/Permissions. Ships with a default
    `admin` / `admin` account that's forced to set a real password on first
    login. Every route is permission-gated — see "Access control" below.
  - **Dashboard**: a card per environment (node) Dry Dock manages, showing
    online/offline status, Docker version, container/image counts, CPU
    count, and memory — refreshed every 10s.
  - **Environments (multi-node)**: an **environment wizard** to connect Dry
    Dock to more than just its own host — either a **standalone Docker
    node** (direct TCP/SSH-tunneled connection to another Docker Engine) or
    a **self-hosted Dry Dock manager** (proxying API calls through another
    Dry Dock instance, which can itself be managing a further server — a
    chain). See "Multi-node" below for details.
  - Containers: list, select one/many, and run **start / stop / restart /
    pause / resume / kill / remove** on the selection at once, scoped to
    whichever environment is selected in the topbar switcher. Per-row logs
    and live stats too. The Dry Dock container itself is automatically
    excluded from the destructive actions on its own (local) host.
  - **Add container**: either pull-and-run a brand new image, or launch
    straight from an image you've already got locally — with ports, env
    vars, command, and restart policy either way.
  - **Monitoring**: a live table of every running container's CPU, memory,
    network, and disk I/O, polling every few seconds — plus a per-container
    stats modal with a CPU sparkline.
  - Images: list, pull (with live progress), remove.
  - **Volumes & Networks**: list, create, and remove — same environment-
    scoped, agent-compatible treatment as Containers/Images, built on the
    same shared-handler pattern.
  - **Live log streaming**: a "Follow" toggle in the Logs modal switches
    from a static tail to a real-time Server-Sent Events stream — no
    polling, the connection just stays open and pushes new lines as Docker
    emits them.
  - **Background health checks**: every environment is pinged every 20s by
    a server-side poller independent of whether the Dashboard is even
    open, so status is always fresh and the Dashboard itself loads
    instantly from cache instead of waiting on every node's round-trip.
  - **Stacks**: Portainer-style Compose stack management — write or paste a
    `docker-compose.yml`, deploy it, and start/stop/redeploy/remove it as a
    unit. Works by shelling out to the real `docker compose` CLI against
    whichever node's Docker Engine is selected (local, a standalone node, or
    through a Dry Dock Agent) — see "Stacks" below for the details and
    current limits.
  - **Activity log**: every meaningful action — sign-ins, container/image/
    stack changes, environment and access-control edits — is recorded with
    who did it and when. Viewable under Administrator → Activity, with
    automatic retention cleanup (see Settings).
  - **Notifications**: a bell in the topbar shows recent activity with an
    unread count, plus optional toast pop-ups for new activity as it
    happens (toggle in Settings).
  - **Settings**: a new admin page (distinct from Appearance) for activity
    log retention (default 15 days), the notifications toggle, and session
    duration — see "Settings" below.
  - **Compose Generator**: a guided 7-step wizard (Basic, Docker Access,
    Extra Storage, Runtime, Security, Storage backend, Authentication) that
    builds a real `docker-compose.yml` live as you fill it in — every field
    maps to something the server actually reads (`PORT`,
    `DOCKER_SOCKET_PATH`/socket-proxy mode, `LOG_LEVEL`/`LOG_JSON`,
    `JWT_SECRET`/`AGENT_TOKEN`). Steps for things Dry Dock doesn't support
    yet (external Postgres, OIDC) are shown but clearly marked "coming
    soon" rather than emitting settings that don't do anything.
  - **Dry Dock Agent**: a separate, much smaller companion app for remote
    nodes — deploy this instead of the full manager when you just need
    Docker access exposed behind a shared secret. It's distributed as its
    own download (`drydock-agent`, not bundled in this zip) and is
    protocol-compatible with the manager's own built-in agent surface, so
    the wizard's "Self-hosted manager / Dry Dock Agent" environment type
    works with either one. See the agent package's own README.
  - **Appearance**: 5 built-in presets (locked — pick one as a starting
    point, but it won't overwrite the original) plus a **Randomize** button
    and your own **custom presets** you can save, reuse, and delete. Colors
    are otherwise fully editable per-field, Mattermost-style. The active
    theme is saved server-side (`server/data/theme.json`) so it persists
    across browsers/devices, with a localStorage fallback for instant load.

## Run it (Docker Compose — recommended)

```bash
docker compose up -d --build
```

Then open **http://localhost:4000** and log in with `admin` / `admin` (you'll
be prompted to set a new password immediately).

That's it — the compose file mounts your host's Docker socket into the
container so Dry Dock can see and manage your other containers, and a named
volume so your saved theme, users, and environments survive restarts/updates.

> ⚠️ Mounting `/var/run/docker.sock` gives the container root-equivalent
> control over your host. Even with login enabled, only expose port 4000 to
> networks/people you trust — consider a reverse proxy with TLS in front of
> it for anything beyond your LAN.

## Access control

Three building blocks, same shape as most team-based tools:

- **Users** — an account with a username/password and zero or more roles
  assigned directly.
- **Teams** — a group of users; roles can be granted to a team so every
  member inherits them (new users are auto-added to the default "Everyone"
  team).
- **Roles** — a named bundle of permissions (e.g. `containers.manage`,
  `environments.manage`, `users.manage` — see `server/lib/rbac.js` for the
  full catalogue). Three built-in roles ship out of the box:
  **Administrator** (everything), **Member** (operate containers/images),
  and **Viewer** (read-only).

A user's *effective* permissions are the union of their direct roles and
every role granted to a team they belong to. Manage all of this under
**Access Control** in the sidebar (visible to anyone with `users.manage`).

## Multi-node ("Environments")

Dry Dock always has one built-in environment, **"This host"** — the local
Docker socket, same as before. From **Dashboard → Add environment** you can
add more:

- **Standalone Docker node** — Dry Dock connects directly to another
  machine's Docker Engine over TCP (`dockerd -H tcp://0.0.0.0:2375`, ideally
  behind an SSH tunnel or with TLS client certs — the wizard has a TLS
  toggle for CA/cert/key). No agent software needed on that box, just a
  reachable Docker daemon.
- **Self-hosted Dry Dock manager** — instead of reaching a Docker Engine
  directly, Dry Dock proxies API calls through *another Dry Dock instance's*
  HTTP API, authenticated with a shared **agent token** (find yours under
  Dashboard → Add environment → that instance's Environments →
  "Agent token"). This is for nodes you can't reach directly but that
  another Dry Dock can — including chaining further: point the "remote
  environment id" field at one of *that* instance's own standalone/agent
  environments to reach a third server through it.

Once added, use the **environment switcher** in the topbar (Containers /
Monitoring / Images / Stacks pages) to jump between nodes. Container/image
permissions apply per-user across every environment; environment
management itself (`environments.manage`) is a separate permission.

## Stacks

Deploy and manage a `docker-compose.yml` as a named unit, Portainer-style:
**Stacks → New stack**, paste or write the compose content, deploy. Each
stack's file is saved server-side (`server/data/stacks/<name>.yml`) and
tracked in an index (`server/data/stacks.json`); actions (start/stop/
redeploy/remove) shell out to the real `docker compose` CLI against
whichever node is selected.

**Current limits, honestly stated:**

- Works on the **local** node and **standalone** nodes (plain TCP, no TLS
  yet — see the error message if you try). It also works through a **Dry
  Dock Agent**, since the agent has the same `docker compose` CLI built in
  and runs the stack on its own node.
- Stack names double as the Compose project name: lowercase letters,
  numbers, and hyphens only.
- No visual service/dependency graph or drag-and-drop editing — it's a
  compose-file editor plus deploy/start/stop/remove, not a compose file
  *generator* for arbitrary stacks (that's what the Compose Generator does,
  for Dry Dock's own deployment specifically).
- Logs are `docker compose logs --tail`, not a live stream yet.

## Activity log & notifications

Every mutating action (container/image/stack changes, environment and
access-control edits, sign-ins) is recorded to `server/data/activity.json`
with who did it, what it was, and whether it succeeded — viewable under
**Administrator → Activity** (gated by the `activity.view` permission;
clearing it needs `activity.manage`). Old entries are pruned automatically
based on the retention setting (checked hourly).

The topbar bell polls the same log and shows a dropdown of recent activity
with an unread badge, plus optional toast pop-ups for new activity as it
happens — both driven by the same permission, so what you can see in
Activity is what shows up in the bell too.

## Settings

A new admin page (**Administrator → Settings**, separate from Appearance)
for things that aren't visual:

- **Activity log retention** — how many days entries stay before being
  pruned. Defaults to **15 days**.
- **Notifications** — on/off switch for the toast pop-ups described above
  (the bell's dropdown and unread count still work either way).
- **Session duration** — how many days a login session lasts before
  requiring sign-in again. Applies to sessions created *after* you save it;
  existing sessions keep whatever expiry they were issued with.
- **Auto sign-out after inactivity** — signs everyone out after N minutes
  of no mouse/keyboard/scroll activity (default 60; set to 0 to disable).
  Checked against real elapsed time, not a naive timer, so it still fires
  correctly even if the tab was backgrounded.

All four are backed by real settings (`server/data/settings.json`), not
placeholders — gated by the `settings.manage` permission (Administrator
role only, by default).

## Run it locally (development)

Two terminals:

```bash
# Terminal 1 — API server (needs access to a Docker socket)
cd server
npm install
npm run dev          # listens on :4000

# Terminal 2 — React dev server with hot reload
cd client
npm install
npm run dev           # listens on :5173, proxies /api to :4000
```

Visit **http://localhost:5173** while developing.

If you're on macOS/Windows with Docker Desktop, `/var/run/docker.sock`
should already exist and work out of the box for the local (non-container)
server. If you're running the *server itself* inside a container, remember
to mount the socket in, same as the compose file does.

## Customizing the look

Go to **Appearance** in the sidebar. Pick one of the five built-in presets
(Dry Dock, Deep Sea, Graphite, Quay, Signal) as a starting point, or open any
individual color — page background, sidebar, primary accent, status colors,
etc. — and set an exact hex value or use the color picker. Every change
previews instantly across the whole app; hit **Save theme** to persist it.

Under the hood this works exactly like Mattermost's theme system: colors are
CSS custom properties (`--color-primary`, `--color-sidebarBg`, ...) set on
`<html>` at runtime, and the whole stylesheet is written against those
variables instead of hardcoded colors. Want to add a new themeable color?
Add it to `server/data/theme.json`, `client/src/theme/presets.js`
(`colorFields` + each preset), and reference `var(--color-yourKey)` in
`client/src/styles/global.css`.

## Project layout

```
server/
  server.js                 Express app, serves the built client in production
  lib/
    docker.js                 dockerode connection for the LOCAL socket, getDockerSummary() helper
    dockerPool.js              per-environment dockerode connections (local/standalone) + ping/test + composeEnvVars()
    containerHandlers.js        shared container/image route logic (used by both the user-facing and agent routers)
    stackHandlers.js             shared Stacks route logic — shells out to `docker compose` (same dual-use pattern)
    cadvisor.js                   fetches + normalizes cAdvisor stats into the same shape as dockerode stats
    self.js                      detects Dry Dock's own container ID for self-protection
    stats.js                       turns raw Docker stats into CPU%/mem/net/disk numbers
    activity.js                     append/list/prune the activity log (retention-aware)
    store.js                        generic JSON-file collections (users/teams/roles/environments/settings/activity) + theme/presets
    auth.js                          password hashing, JWT session signing (config-aware duration), agent token management
    rbac.js                           permission catalogue + default roles + effective-permission calculation
    seed.js                            first-boot defaults: admin user, roles, default team, local environment
    logger.js                          LOG_LEVEL/LOG_JSON-aware logger + request logging middleware
  middleware/
    auth.js                   session auth (attachUser/requireAuth) + requirePermission
    environment.js              resolves ?env=<id>, proxies to agent-type environments, guards the agent API
    activityLogger.js            turns mutating requests into human-readable activity log entries
  routes/
    auth.js                   login/logout/me/change-password
    users.js / teams.js / roles.js   admin CRUD, gated by users.manage/teams.manage/roles.manage
    environments.js             CRUD for nodes, connection testing, agent token, cAdvisor test
    dashboard.js                  aggregated status card per environment
    agent.js                       machine-to-machine surface (agent token auth) other Dry Dock instances call into
    containers.js / images.js       environment-aware, permission-gated container/image routes
    stacks.js                        environment-aware Stacks routes (local/standalone direct, agent proxied)
    activity.js                       list/clear the activity log
    settings.js                        retention/notifications/session-duration settings
    theme.js / presets.js            appearance, gated by appearance.manage for writes
  data/                       persisted JSON + stack compose files (mount this whole directory as a volume)
client/
  src/App.jsx                page routing + auth gate (login / forced password change / shell)
  src/context/AuthContext.jsx   current user, permissions, login/logout
  src/context/EnvironmentContext.jsx  selected node, node list, "has picked a node yet" state
  src/pages/
    Login.jsx                  sign-in screen
    Dashboard.jsx                environment cards + "add environment" entry point
    Admin.jsx + admin/            Users.jsx, Teams.jsx, Roles.jsx tabs
    Containers.jsx, Monitoring.jsx, Images.jsx   environment-scoped
    Stacks.jsx                    Compose stack list + deploy/start/stop/remove
    Activity.jsx                   activity log viewer
    SystemSettings.jsx              retention / notifications / session duration (the "Settings" page)
    Settings.jsx                     the Appearance page (kept its old filename; routed as "appearance")
    ComposeGenerator.jsx             guided docker-compose.yml builder for Dry Dock's own deployment
  src/components/
    EnvironmentWizard.jsx       standalone-node / self-hosted-manager connection wizard
    EnvironmentSwitcher.jsx       topbar node picker
    ChangePasswordModal.jsx        forced password reset on first login
    NotificationBell.jsx            topbar bell — unread badge, recent-activity dropdown, toast pop-ups
    StackEditorModal.jsx             create/edit a stack's compose content
    CadvisorSettingsModal.jsx         per-node cAdvisor URL (Monitoring page)
    Sidebar, StatusDot, LogsModal, StatsModal, StatBar, Sparkline, ColorField, CreateContainerModal, LoadingState, LogoMark
  src/lib/composeYaml.js       pure config -> docker-compose.yml generator used by ComposeGenerator
  src/theme/               ThemeContext.jsx, presets.js (built-in, locked), random.js (theme randomizer)
  src/lib/                  format.js, permissions.js (client-side permission key constants), useMinLoadingTime.js
  src/api.js                fetch wrapper — env-scoping, auth, admin, stacks, activity, and settings endpoints
  src/styles/global.css    every color is a CSS variable

Dry Dock Agent is a separate download (its own zip, own README) — not
bundled under this repo. It shares the same lib/ file *contents* as
server/lib (containerHandlers.js, stackHandlers.js, cadvisor.js, etc. are
byte-for-byte identical between the two), just packaged standalone so it
stays a ~15KB install rather than requiring the whole manager stack on
every node.
```

## What's not here yet

- Stacks: TLS-secured standalone nodes, drag-and-drop compose editing, and
  version history/rollback — see the Stacks section above for the current
  limits (container logs now stream live; stack logs are still a static
  tail via `docker compose logs`).
- Container terminal/exec (a web-based `docker exec` shell).
- Compose stack templates/marketplace (one-click deploy of common stacks —
  right now Stacks starts from a blank editor).
- Image vulnerability scanning (Trivy/Grype integration on the Images page).
- Private registry auth (currently anonymous Docker Hub pulls only).
- Historical metrics (current monitoring is live-only unless you've pointed
  it at cAdvisor; nothing is persisted long-term, so there's no "CPU over
  the last 30 days" view yet — the new background health poller tracks
  online/offline status, not historical performance data).
- Threshold-based alerting (container down, disk/memory pressure) feeding
  into the Notifications system.
- Per-environment permissions (roles are global today — no "this team can
  only touch the staging node" scoping yet).
- Richer audit detail (the Activity log records what happened, not
  before/after diffs of config changes).
- API tokens for scripting against Dry Dock without a session cookie.
- Per-user theme and notification preferences (both are global settings
  today, not per-account).
- SSO / OAuth login (only local username+password accounts for now — the
  Compose Generator's Authentication step is a placeholder for this).
- External database backend (currently JSON files only — the Compose
  Generator's Storage step is a placeholder for this too).
- Mobile-responsive layout (sidebar/topbar are desktop-oriented).

Happy to build out any of these next — just say which one.

