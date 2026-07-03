#!/bin/sh
# Quick install for a fresh server: generates an AGENT_TOKEN if you don't
# already have one, builds the image, and starts the agent.
#
# Usage:
#   ./install.sh                 # generates a token for you
#   AGENT_TOKEN=xxxx ./install.sh  # use your own token
set -e

if [ -z "$AGENT_TOKEN" ]; then
  if [ -f .env ] && grep -q '^AGENT_TOKEN=.\+' .env; then
    echo "Using existing AGENT_TOKEN from .env"
  else
    AGENT_TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
    cp -n .env.example .env 2>/dev/null || true
    if grep -q '^AGENT_TOKEN=' .env 2>/dev/null; then
      sed -i.bak "s/^AGENT_TOKEN=.*/AGENT_TOKEN=${AGENT_TOKEN}/" .env && rm -f .env.bak
    else
      echo "AGENT_TOKEN=${AGENT_TOKEN}" >> .env
    fi
    echo ""
    echo "Generated a new agent token:"
    echo ""
    echo "  ${AGENT_TOKEN}"
    echo ""
    echo "Copy this into Dry Dock's environment wizard (Dashboard -> Add"
    echo "environment -> Self-hosted manager / Dry Dock Agent). It's also"
    echo "saved in ./.env for later."
    echo ""
  fi
fi

docker compose --env-file .env up -d --build

echo ""
echo "Dry Dock Agent is starting. Check status with:"
echo "  docker compose logs -f"
echo ""
echo "Base URL to enter in the manager's wizard:"
echo "  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<this-server-ip>'):4001"
