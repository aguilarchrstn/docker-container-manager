#!/bin/sh
set -e

# If PUID/PGID are set, run as that user/group instead of root — same
# convention linuxserver.io images use, wired up here for the Compose
# Generator's "Basic setup" step. Ownership of the data dir is fixed up
# so a freshly-mounted volume is writable by that user. If neither is
# set, behavior is unchanged from before (runs as root, no remapping).
if [ -n "$PUID" ] && [ -n "$PGID" ]; then
  if ! getent group "$PGID" >/dev/null 2>&1; then
    addgroup -g "$PGID" drydock
  fi
  GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)

  if ! getent passwd "$PUID" >/dev/null 2>&1; then
    adduser -D -H -u "$PUID" -G "$GROUP_NAME" drydock
  fi
  USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)

  mkdir -p /app/server/data
  chown -R "$PUID:$PGID" /app/server/data

  exec su-exec "$PUID:$PGID" "$@"
fi

exec "$@"
