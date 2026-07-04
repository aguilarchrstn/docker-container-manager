// cAdvisor (https://github.com/google/cadvisor) exposes a richer, host-level
// view of every container's metrics — this normalizes its response into the
// exact shape server/lib/stats.js produces from dockerode's per-container
// stats stream, so Monitoring.jsx doesn't need to know or care which source
// the numbers came from.

function extractNetwork(sample) {
  let rx = 0;
  let tx = 0;
  if (Array.isArray(sample?.network?.interfaces)) {
    for (const iface of sample.network.interfaces) {
      rx += iface.rx_bytes || 0;
      tx += iface.tx_bytes || 0;
    }
  } else if (sample?.network) {
    rx = sample.network.rx_bytes || 0;
    tx = sample.network.tx_bytes || 0;
  }
  return { rx, tx };
}

function extractDiskIO(sample) {
  let read = 0;
  let write = 0;
  const entries = sample?.diskio?.io_service_bytes || [];
  for (const entry of entries) {
    const stats = entry.stats || {};
    // cAdvisor has used both capitalized keys (older) and an array-of-op
    // shape (newer) across versions — handle both.
    if (typeof stats.Read === "number" || typeof stats.Write === "number") {
      read += stats.Read || 0;
      write += stats.Write || 0;
    } else {
      for (const [op, value] of Object.entries(stats)) {
        if (/read/i.test(op)) read += value || 0;
        if (/write/i.test(op)) write += value || 0;
      }
    }
  }
  return { read, write };
}

// baseUrl points at the cAdvisor instance itself (e.g. http://host:8081 if
// that's how it's published — cAdvisor listens on 8080 internally).
export async function fetchCadvisorStats(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1.3/docker/?count=2`);
  if (!res.ok) throw new Error(`cAdvisor responded ${res.status}`);
  const data = await res.json();

  const results = [];
  for (const [cgroupPath, info] of Object.entries(data)) {
    if (!cgroupPath.startsWith("/docker/")) continue; // skip the aggregate root entry
    const id = cgroupPath.replace("/docker/", "");
    if (id.length < 12) continue; // not a real container cgroup

    const samples = info.stats || [];
    if (samples.length === 0) continue;
    const last = samples[samples.length - 1];
    const prev = samples.length > 1 ? samples[samples.length - 2] : null;

    let cpuPercent = 0;
    if (prev) {
      const deltaNs = (last.cpu?.usage?.total || 0) - (prev.cpu?.usage?.total || 0);
      const deltaWallMs = new Date(last.timestamp) - new Date(prev.timestamp);
      if (deltaWallMs > 0) cpuPercent = (deltaNs / (deltaWallMs * 1e6)) * 100;
    }

    const memUsage = last.memory?.working_set ?? last.memory?.usage ?? 0;
    const specLimit = info.spec?.memory?.limit;
    // An unset per-container limit shows up as a huge sentinel value
    // (effectively "unlimited") — treat that the same as 0/no-limit.
    const memLimit = specLimit && specLimit < Number.MAX_SAFE_INTEGER ? specLimit : 0;
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    const { rx, tx } = extractNetwork(last);
    const { read, write } = extractDiskIO(last);

    results.push({
      id,
      shortId: id.slice(0, 12),
      name: (info.aliases?.[0] || id).replace(/^\//, ""),
      cpuPercent,
      memUsage,
      memLimit,
      memPercent,
      netRx: rx,
      netTx: tx,
      blockRead: read,
      blockWrite: write,
      pids: last.task_stats?.nr_running ?? 0,
    });
  }
  return results;
}

export async function fetchCadvisorStatsForOne(baseUrl, containerId) {
  const all = await fetchCadvisorStats(baseUrl);
  const match = all.find((c) => c.id === containerId || c.id.startsWith(containerId));
  if (!match) throw new Error("Container not found in cAdvisor's report");
  return match;
}

export async function assertCadvisorReachable(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1.3/machine`);
  if (!res.ok) throw new Error(`cAdvisor responded ${res.status}`);
  return res.json();
}
