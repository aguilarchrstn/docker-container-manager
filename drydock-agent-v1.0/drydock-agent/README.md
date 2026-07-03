# Dry Dock Agent

A lightweight HTTP daemon that runs on a remote Docker host and lets the
Dry Dock manager control it without exposing the raw Docker socket to the
network.

## Run

```bash
docker run -d \
  -p 4001:4001 \
  --name drydock_agent \
  --restart=always \
  -e AGENT_TOKEN=change-me-please \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/lib/docker/volumes:/var/lib/docker/volumes \
  -v /:/host:ro \
  drydock/agent:1.0
```

If you omit `AGENT_TOKEN` the agent generates one on first boot, persists it
to `/data/agent-token`, and prints it in the container logs — copy that
value into the Dry Dock manager's Environment Wizard.

## API

All routes except `/health` and `/version` require `Authorization: Bearer <token>`
(or `X-Agent-Token: <token>`).

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/health`                         | Liveness probe                             |
| GET    | `/version`                        | Agent + runtime info                       |
| GET    | `/info`                           | Host + Docker info / df                    |
| GET    | `/containers?all=true`            | List containers                            |
| POST   | `/containers/:id/{start,stop,restart,pause,unpause,kill}` | Container lifecycle |
| DELETE | `/containers/:id`                 | Remove container                           |
| GET    | `/containers/:id/logs?tail=200`   | Tail logs                                  |
| GET    | `/images`                         | List images                                |
| GET    | `/volumes`                        | List volumes                               |
| GET    | `/networks`                       | List networks                              |
| POST   | `/compose/up`                     | Deploy a `docker-compose.yml`              |
| ANY    | `/docker/*`                       | Raw pass-through to the Docker Engine API  |

The `/docker/*` prefix means the manager can point Dockerode at
`http://host:4001/docker` (with the bearer token) and use it exactly like a
remote TCP Docker daemon.

## Wiring into the Dry Dock manager

In the manager's **Environment Wizard**, pick `Agent (HTTP)` as the connection
type and enter:

- URL: `http://<host>:4001`
- Token: the value from `AGENT_TOKEN` or the printed pairing token

The manager stores the token encrypted and sends it with every request.
