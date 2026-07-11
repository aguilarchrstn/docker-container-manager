import { readCollection } from "./store.js";
import { pingEnvironment } from "./dockerPool.js";
import { logger } from "./logger.js";

const POLL_MS = 20000;
const cache = new Map(); // envId -> { ok, info, error, checkedAt }

async function pollOnce() {
  const environments = await readCollection("environments", []);
  await Promise.all(
    environments.map(async (env) => {
      try {
        const result = await pingEnvironment(env);
        cache.set(env.id, { ...result, checkedAt: Date.now() });
      } catch (err) {
        cache.set(env.id, { ok: false, error: err.message, checkedAt: Date.now() });
      }
    })
  );
}

let started = false;

// Runs independently of any request — the Dashboard (and anything else
// that wants node status) reads from this cache instead of pinging live
// on every page load, so status is fresh even if nobody has the Dashboard
// open, and the Dashboard itself loads instantly instead of waiting on
// every node's network round-trip.
export function startHealthPoller() {
  if (started) return;
  started = true;
  pollOnce().catch((err) => logger.error("Health poller failed", { error: err.message }));
  setInterval(() => {
    pollOnce().catch((err) => logger.error("Health poller failed", { error: err.message }));
  }, POLL_MS);
}

// Returns the cached result for one environment, or null if it hasn't
// been polled yet (e.g. added seconds ago, before the next cycle).
export function getCachedHealth(envId) {
  return cache.get(envId) || null;
}

export function getAllCachedHealth() {
  return cache;
}

export function evictCachedHealth(envId) {
  cache.delete(envId);
}
