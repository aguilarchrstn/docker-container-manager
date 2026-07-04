import { randomUUID } from "crypto";
import { readCollection, writeCollection, readSettings } from "./store.js";

const DEFAULT_RETENTION_DAYS = 15;

async function pruneList(list) {
  const settings = await readSettings();
  const days = settings.activityRetentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return list.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

export async function logActivity(entry) {
  const list = await readCollection("activity", []);
  list.push({ id: randomUUID(), timestamp: new Date().toISOString(), ...entry });
  const pruned = await pruneList(list);
  await writeCollection("activity", pruned);
  return pruned[pruned.length - 1];
}

export async function listActivity({ limit = 100, since } = {}) {
  const list = await readCollection("activity", []);
  let filtered = list;
  if (since) filtered = filtered.filter((e) => e.timestamp > since);
  return filtered.slice(-limit).reverse();
}

export async function clearActivity() {
  await writeCollection("activity", []);
}

// Called on a timer (see server.js) so retention actually takes effect
// even during quiet periods with no new activity to trigger a prune.
export async function pruneActivityNow() {
  const list = await readCollection("activity", []);
  const pruned = await pruneList(list);
  if (pruned.length !== list.length) await writeCollection("activity", pruned);
  return pruned.length;
}
