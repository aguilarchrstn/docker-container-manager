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
  - **Add container**: either pull-and-run a brand new image, or launch
    straight from an image you've already got locally — with ports, env
    vars, command, and restart policy either way.
  - **Monitoring**: a live table of every running container's CPU, memory,
    network, and disk I/O, polling every few seconds — plus a per-container
    stats modal with a CPU sparkline.
  - Images: list, pull (with live progress), remove.
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
  lib/store.js              reads/writes the saved theme + custom presets JSON
  routes/containers.js       list/start/stop/restart/pause/unpause/kill/remove/logs/stats/create
  routes/images.js            list/pull (streamed progress)/remove
  routes/theme.js               GET/PUT the active/default theme
  routes/presets.js               CRUD for user-saved custom presets
  data/theme.json                   persisted active theme (mount this as a volume)
  data/presets.json                   persisted custom presets (same volume)
client/
  src/App.jsx             page routing (containers / monitoring / images / settings)
  src/pages/               Containers.jsx, Monitoring.jsx, Images.jsx, Settings.jsx
  src/theme/               ThemeContext.jsx, presets.js (built-in, locked),
                            random.js (theme randomizer)
  src/components/          Sidebar, StatusDot, LogsModal, StatsModal, StatBar,
                            Sparkline, ColorField, CreateContainerModal
  src/lib/format.js        byte/percent formatting helpers
  src/styles/global.css    every color is a CSS variable
```

## v1.1 — what's new

- **Login screen + user accounts.** SQLite-backed users, bcrypt password
  hashes, JWT sessions. A default `admin` / `admin` account is seeded on
  first boot — **change the password immediately** from the Administration
  page or `POST /api/auth/change-password`.
- **Dashboard.** Aggregated view of every configured environment: nodes
  online/offline, container and image totals, per-node health and engine
  version, one click to switch the active environment.
- **Environments + wizard.** Manage one or more Docker endpoints. v1
  ships with local socket support; the wizard also has slots for TCP/TLS,
  SSH, and remote Dry Dock federation which the backend factory already
  understands but which need connection material wired in per install.
  Every existing route is now environment-aware via the `x-env-id` header.
- **Access control.** Roles (`admin`, `editor`, `viewer` seeded, plus any
  custom role you create), a permissions catalog (`envs.*`, `containers.*`,
  `images.*`, `appearance.write`, `admin`), and teams for grouping users.
  Every API route is now guarded by the matching permission.

### Configuration

Environment variables:

| Variable          | Default                       | Purpose                        |
| ----------------- | ----------------------------- | ------------------------------ |
| `PORT`            | `4000`                        | HTTP port                      |
| `AUTH_SECRET`     | dev placeholder — **change**  | JWT signing key                |
| `DB_PATH`         | `server/data/app.db`          | SQLite database path           |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock`     | Default local env socket path  |

The compose volume `drydock-data` already covers both `app.db` and the
theme/presets JSON.

## What's not here yet

- TCP/TLS, SSH, and remote-node environment kinds are wired in the wizard
  and factory but need real certificate/token plumbing per your setup.
- Historical metrics.
- Volumes / networks / Compose stack management.
- Live-streaming logs (currently the last N lines on open).
- Password reset flow (admins can reset from the Users tab).

