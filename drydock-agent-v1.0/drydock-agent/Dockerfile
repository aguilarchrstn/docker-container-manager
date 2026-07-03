FROM node:20-alpine

# docker CLI so /compose/up can shell out to `docker compose`
RUN apk add --no-cache docker-cli docker-cli-compose tini

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

EXPOSE 4001
VOLUME ["/data"]

ENV AGENT_PORT=4001 \
    DOCKER_SOCKET=/var/run/docker.sock \
    HOST_ROOT=/host

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
