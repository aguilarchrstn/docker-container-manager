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
  - **Compose Generator**: a guided 7-step wizard (Basic, Docker Access,
    Extra Storage, Runtime, Security, Storage backend, Authentication) that
    builds a real `docker-compose.yml` live as you fill it in — every field
    maps to something the server actually reads (`PORT`, `PUID`/`PGID`,
    `DOCKER_SOCKET_PATH`/socket-proxy mode, `LOG_LEVEL`/`LOG_JSON`,
    `JWT_SECRET`/`AGENT_TOKEN`). Steps for things Dry Dock doesn't support
    yet (external Postgres, OIDC) are shown but clearly marked "coming
    soon" rather than emitting settings that don't do anything.
  - **Dry Dock Agent** (`agent/`): a separate, much smaller companion app
    for remote nodes — deploy this instead of the full manager when you
    just need Docker access exposed behind a shared secret. It's protocol-
    compatible with the manager's own built-in agent surface, so the
    wizard's "Self-hosted manager / Dry Dock Agent" environment type works
    with either one. See `agent/README.md`.
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
Monitoring / Images pages) to jump between nodes. Container/image
permissions apply per-user across every environment; environment
management itself (`environments.manage`) is a separate permission.

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
    docker.js                 dockerode connection for the LOCAL socket
    dockerPool.js              per-environment dockerode connections (local/standalone) + ping/test
    containerHandlers.js        shared container/image route logic (used by both the user-facing and agent routers)
    self.js                      detects Dry Dock's own container ID for self-protection
    stats.js                       turns raw Docker stats into CPU%/mem/net/disk numbers
    store.js                        generic JSON-file collections (users/teams/roles/environments/settings) + theme/presets
    auth.js                          password hashing, JWT session signing, agent token management
    rbac.js                           permission catalogue + default roles + effective-permission calculation
    seed.js                            first-boot defaults: admin user, roles, default team, local environment
  middleware/
    auth.js                   session auth (attachUser/requireAuth) + requirePermission
    environment.js              resolves ?env=<id>, proxies to agent-type environments, guards the agent API
  routes/
    auth.js                   login/logout/me/change-password
    users.js / teams.js / roles.js   admin CRUD, gated by users.manage/teams.manage/roles.manage
    environments.js             CRUD for nodes, connection testing, agent token
    dashboard.js                  aggregated status card per environment
    agent.js                       machine-to-machine surface (agent token auth) other Dry Dock instances call into
    containers.js / images.js       environment-aware, permission-gated container/image routes
    theme.js / presets.js            appearance, gated by appearance.manage for writes
  data/                       persisted JSON (mount this whole directory as a volume)
client/
  src/App.jsx                page routing + auth gate (login / forced password change / shell)
  src/context/AuthContext.jsx   current user, permissions, login/logout
  src/pages/
    Login.jsx                  sign-in screen
    Dashboard.jsx                environment cards + "add environment" entry point
    Admin.jsx + admin/            Users.jsx, Teams.jsx, Roles.jsx tabs
    Containers.jsx, Monitoring.jsx, Images.jsx, Settings.jsx   (unchanged, now environment-scoped)
  src/components/
    EnvironmentWizard.jsx       standalone-node / self-hosted-manager connection wizard
    EnvironmentSwitcher.jsx       topbar node picker
    ChangePasswordModal.jsx        forced password reset on first login
    Sidebar, StatusDot, LogsModal, StatsModal, StatBar, Sparkline, ColorField, CreateContainerModal
  src/pages/ComposeGenerator.jsx  guided docker-compose.yml builder (live preview, copy/download)
  src/lib/composeYaml.js       pure config -> docker-compose.yml generator used by the page above
  src/theme/               ThemeContext.jsx, presets.js (built-in, locked), random.js (theme randomizer)
  src/lib/                  format.js, permissions.js (client-side permission key constants)
  src/api.js                fetch wrapper — env-scoping, auth, and admin endpoints
  src/styles/global.css    every color is a CSS variable
agent/                    standalone lightweight companion app for remote nodes (see agent/README.md)
  server.js                 minimal Express app, mounts the same /api/agent/* contract as the manager
  lib/                        docker.js, self.js, stats.js, logger.js, dockerPool.js, auth.js, containerHandlers.js
                               (containerHandlers.js is byte-for-byte the same file as server/lib/containerHandlers.js)
  Dockerfile, docker-compose.yml, README.md
```

## What's not here yet

- Volumes and networks management (list/create/remove).
- Docker Compose *stack* support (deploy/tear down an arbitrary
  `docker-compose.yml` from the UI, like Portainer's "stacks" — the new
  Compose Generator builds Dry Dock's *own* deployment file, which is a
  different thing).
- Live-streaming logs (currently pulls the last 200 lines on open; a
  websocket/SSE tail would make it live).
- Historical metrics (current monitoring is live-only; nothing is persisted,
  so there's no "CPU over the last 24 hours" view yet).
- Per-user theme profiles (the saved theme is still global, not per-account).
- Audit log of who did what, where.
- SSO / OAuth login (only local username+password accounts for now — the
  Compose Generator's Authentication step is a placeholder for this).
- External database backend (currently JSON files only — the Compose
  Generator's Storage step is a placeholder for this too).

Happy to build out any of these next — just say which one.

