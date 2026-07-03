# Dry Dock Agent

A tiny companion service for [Dry Dock](../README.md) — install this
on any server or node you want to manage remotely, **without** running the
full Dry Dock manager (React UI, users/teams/roles, theme system) there.
It's just Docker access behind a shared secret: two dependencies, one
small Express server.

Install this on Node/Server B. Your main Dry Dock manager (running
wherever it already is) connects to it over HTTP.

## Install

**Option A — one command (needs Docker + Docker Compose already installed):**

```bash
unzip drydock-agent-v1.0.zip -d drydock-agent
cd drydock-agent
./install.sh
```

This generates a random `AGENT_TOKEN`, saves it to `.env`, and starts the
agent. It prints the token and the base URL to enter into the manager.

**Option B — manual:**

```bash
unzip drydock-agent-v1.0.zip -d drydock-agent
cd drydock-agent
cp .env.example .env
# edit .env — set AGENT_TOKEN to a real secret, e.g.:
openssl rand -hex 24
docker compose up -d --build
```

**Option C — plain Docker, no Compose:**

```bash
docker build -t drydock-agent .
docker run -d --name drydock-agent \
  -p 4001:4001 \
  -e AGENT_TOKEN=$(openssl rand -hex 24) \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --restart unless-stopped \
  drydock-agent
docker logs drydock-agent   # confirm it's listening + the token if generated inline
```

**Option D — no Docker, straight Node.js (v18+):**

```bash
unzip drydock-agent-v1.0.zip -d drydock-agent
cd drydock-agent
npm install --omit=dev
AGENT_TOKEN=$(openssl rand -hex 24) PORT=4001 node server.js
```

Requires the machine running it to have access to `/var/run/docker.sock`
(default) or a reachable `DOCKER_HOST`.

## Connect it to your Dry Dock manager

On your main Dry Dock instance: **Dashboard → Add environment →
Self-hosted manager / Dry Dock Agent**, then fill in:

- **Manager / agent base URL**: `http://<this-server's-address>:4001`
- **Agent token**: whatever you set/generated above
- **Remote environment id**: leave blank

Click **Test connection** — it should report the Docker version this
agent's node is running. Save, and this node now shows up on the
manager's Dashboard alongside every other environment.

## Why not just point the manager straight at this node's Docker socket?

You can, if the socket is reachable — that's the wizard's "Standalone
Docker node" option (direct TCP, no agent needed). This agent exists for
when:

- The node isn't directly reachable (NAT, firewall, different network) but
  *can* be reached on one port you expose.
- You want an actual auth boundary (shared secret) instead of bare TCP.
- You want the smallest possible footprint on that node — no UI build, no
  database-shaped JSON files, nothing but Docker access.

## Configuration reference

| Env var              | Required | Default                  | Purpose |
|-----------------------|----------|---------------------------|---------|
| `AGENT_TOKEN`          | **yes**  | —                          | Shared secret the manager authenticates with |
| `PORT`                 | no       | `4001`                     | Port the agent listens on |
| `LOG_LEVEL`            | no       | `info`                     | `silent` / `error` / `warn` / `info` / `debug` |
| `LOG_JSON`             | no       | `false`                    | Emit logs as JSON lines instead of plain text |
| `DOCKER_SOCKET_PATH`   | no       | `/var/run/docker.sock`     | Where the Docker socket is mounted |
| `DOCKER_HOST`          | no       | —                          | Use a TCP Docker endpoint instead of a socket |

## Endpoints

Everything lives under `/api/agent/*` and requires an `x-agent-token`
header matching `AGENT_TOKEN` — this is exactly the contract the main Dry
Dock manager's own built-in agent surface uses, so a full manager and this
lightweight agent are interchangeable as far as the wizard is concerned.

- `GET /health` — unauthenticated, just checks Docker is reachable
- `GET /api/agent/ping` — authenticated reachability + version check
- `GET/POST/DELETE /api/agent/containers...` — list/start/stop/restart/
  pause/unpause/kill/remove/logs/stats/create
- `GET/POST/DELETE /api/agent/images...` — list/pull/remove

## Security notes

- Mounting `/var/run/docker.sock` gives this container root-equivalent
  control over the host it runs on. Only expose port 4001 to networks you
  trust — ideally just to your Dry Dock manager's IP, via a firewall rule
  or security group, not the open internet.
- `AGENT_TOKEN` is the only thing standing between "reachable" and "fully
  controllable." Generate it with something like `openssl rand -hex 24`,
  not a short/guessable string.
- There's no TLS built in — if the manager and this agent talk over the
  public internet, put a reverse proxy (Caddy, nginx, Traefik) with a real
  certificate in front of this agent, or keep them on a private
  network/VPN together.

## Updating

```bash
cd drydock-agent
docker compose pull   # if you're pulling a published image
# or, if building locally:
docker compose up -d --build
```

Your `.env` (and thus your `AGENT_TOKEN`) isn't touched by an update —
only re-run `install.sh`/regenerate it if you actually want to rotate the
secret (and remember to update it in the manager's environment settings
too, or the manager will lose access).
