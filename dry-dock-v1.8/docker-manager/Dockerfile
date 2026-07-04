# --- build the React client ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- assemble the server + static client ---
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache su-exec docker-cli docker-cli-compose

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

RUN chmod +x /app/server/entrypoint.sh

ENV PORT=4000
EXPOSE 4000

WORKDIR /app/server
ENTRYPOINT ["/app/server/entrypoint.sh"]
CMD ["node", "server.js"]
