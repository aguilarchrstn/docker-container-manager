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

# better-sqlite3 compiles a native module at install time.
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

ENV PORT=4000
# Change AUTH_SECRET on every deployment.
ENV AUTH_SECRET=change-me-in-production
EXPOSE 4000

WORKDIR /app/server
CMD ["node", "server.js"]
