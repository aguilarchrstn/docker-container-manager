# Dry Dock Agent

A minimal companion service for [Dry Dock](../README.md). Deploy this on a
node you want to manage remotely **without** running the full manager UI
there — just this small Express service and Docker itself.

It exposes the same `/api/agent/*` contract the full manager exposes
internally, so from the main Dry Dock's point of view, this agent and a
full second Dry Dock instance are interchangeable: either one works as the
target of a **"Self-hosted Dry Dock manager"** environment in the wizard.

## Run it

```bash
cd agent
cp docker-compose.yml docker-compose.override.yml   # optional, or edit directly
# set a real AGENT_TOKEN in docker-compose.yml first
docker compose up -d --build
```

Then, on your main Dry Dock instance: **Dashboard → Add environment →
Self-hosted Dry Dock manager**, and fill in:

- **Manager base URL**: `http://<this-node's-address>:4001`
- **Agent token**: the same `AGENT_TOKEN` you set above
- **Remote environment id**: leave blank — the agent only ever has one node
  (itself)

## Why a separate app instead of just using the wizard's "standalone" type?

The **standalone** environment type connects directly to a bare Docker
Engine over TCP — no auth beyond whatever network-level protection you set
up (TLS certs, a private network, an SSH tunnel). That's the simplest
option if you already trust the network path.

This **agent** exists for everything else:

- The node isn't directly reachable from your main Dry Dock (NAT, firewall,
  different network) but *can* reach out or be reached on one port you
  control.
- You want a real auth boundary (a shared secret) in front of Docker
  access, rather than bare TCP.
- You want a much smaller footprint than the full manager (no React build,
  no user/team/role storage, no theme system) — this is ~2 dependencies.

## Configuration

| Env var       | Required | Default | Purpose                                  |
|---------------|----------|---------|-------------------------------------------|
| `AGENT_TOKEN` | yes      | —       | Shared secret the manager authenticates with |
| `PORT`        | no       | `4001`  | Port the agent listens on                 |
| `LOG_LEVEL`   | no       | `info`  | `silent` / `error` / `warn` / `info` / `debug` |
| `LOG_JSON`    | no       | `false` | Emit logs as JSON lines instead of plain text |
| `DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Where the Docker socket is mounted |
| `DOCKER_HOST` | no       | —       | Use a TCP Docker endpoint instead of a socket |

There's no `docker-manager`-side change required to talk to this — it's
protocol-compatible with the manager's own built-in agent surface.
