# Dry Dock

A small self-hosted Docker container manager — think Portainer/Arcane, but
simple enough to actually read the code, and themeable the way Mattermost
lets you pick every UI color.

- **Backend:** Node.js + Express, talks to the Docker Engine via
  [dockerode](https://github.com/apocas/dockerode) over `/var/run/docker.sock`.
- **Frontend:** React + Vite, no CSS framework — just CSS variables so the
  theme picker can restyle the whole app live.
- **Features:**
  - Containers: list, select one/many, and run **start / stop / restart /
    pause / resume / kill / remove** on the selection at once. Per-row logs
    and live stats too. The Dry Dock container itself is automatically
    excluded from the destructive actions (both in the UI and enforced
    server-side) so you can't accidentally take the app down.
  - **Add container**: pull-and-run a new container from an image, with
    ports, env vars, command, and restart policy.
  - **Monitoring**: a live table of every running container's CPU, memory,
    network, and disk I/O, polling every few seconds — plus a per-container
    stats modal with a CPU sparkline.
  - Images: list, pull (with live progress), remove.
  - **Appearance**: 5 presets plus a per-color custom picker, Mattermost-style.
    Saved server-side (`server/data/theme.json`) so it persists across
    browsers/devices, with a localStorage fallback for instant load.

## Run it (Docker Compose — recommended)

```bash
docker compose up -d --build
```

Then open **http://localhost:4000**.

That's it — the compose file mounts your host's Docker socket into the
container so Dry Dock can see and manage your other containers, and a named
volume so your saved theme survives restarts/updates.

> ⚠️ Mounting `/var/run/docker.sock` gives the container root-equivalent
> control over your host. Only run this on a machine/network you trust, and
> don't expose port 4000 to the public internet without putting something
> like a reverse proxy + auth in front of it (there's no login screen yet —
> see "What's not here yet" below).

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
  server.js            Express app, serves the built client in production
  lib/docker.js         dockerode connection (socket or DOCKER_HOST)
  lib/self.js             detects Dry Dock's own container ID for self-protection
  lib/stats.js             turns raw Docker stats into CPU%/mem/net/disk numbers
  lib/store.js              reads/writes the saved theme JSON
  routes/containers.js       list/start/stop/restart/pause/unpause/kill/remove/logs/stats/create
  routes/images.js            list/pull (streamed progress)/remove
  routes/theme.js               GET/PUT saved theme
  data/theme.json                 persisted theme (mount this as a volume)
client/
  src/App.jsx             page routing (containers / monitoring / images / settings)
  src/pages/               Containers.jsx, Monitoring.jsx, Images.jsx, Settings.jsx
  src/theme/               ThemeContext.jsx, presets.js
  src/components/          Sidebar, StatusDot, LogsModal, StatsModal, StatBar,
                            Sparkline, ColorField, CreateContainerModal
  src/lib/format.js        byte/percent formatting helpers
  src/styles/global.css    every color is a CSS variable
```

## What's not here yet

This is intentionally an MVP. Natural next additions, roughly in order of
how most people would want them:

- **Auth** — a login screen and session cookie before anything else, if
  you're exposing this beyond localhost/your LAN.
- Volumes and networks management (list/create/remove).
- Docker Compose stack support (deploy/tear down a `docker-compose.yml`
  from the UI, like Portainer's "stacks").
- Live-streaming logs (currently pulls the last 200 lines on open; a
  websocket/SSE tail would make it live).
- Historical metrics (current monitoring is live-only; nothing is persisted,
  so there's no "CPU over the last 24 hours" view yet).
- Multi-user theme profiles (right now the saved theme is global, not
  per-account).
- Multi-host support (talk to more than one Docker Engine).

Happy to build out any of these next — just say which one.
