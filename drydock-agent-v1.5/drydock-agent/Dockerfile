FROM node:20-alpine
WORKDIR /app

# docker-cli + the compose plugin are needed for Stacks support (the agent
# shells out to `docker compose` against its own local Docker Engine).
RUN apk add --no-cache docker-cli docker-cli-compose

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=4001
EXPOSE 4001

CMD ["node", "server.js"]
