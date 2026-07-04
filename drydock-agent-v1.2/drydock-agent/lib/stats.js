export function computeCpuPercent(stats) {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage || 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage || 0) -
    (stats.precpu_stats?.system_cpu_usage || 0);
  const onlineCpus =
    stats.cpu_stats?.online_cpus ||
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;

  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * onlineCpus * 100;
  }
  return 0;
}

export function computeMemory(stats) {
  const usageRaw = stats.memory_stats?.usage || 0;
  // Docker's raw "usage" includes page cache; subtract it for a number that
  // matches what `docker stats` shows.
  const cache =
    stats.memory_stats?.stats?.cache ??
    stats.memory_stats?.stats?.inactive_file ??
    0;
  const usage = Math.max(usageRaw - cache, 0);
  const limit = stats.memory_stats?.limit || 0;
  const percent = limit > 0 ? (usage / limit) * 100 : 0;
  return { usage, limit, percent };
}

export function computeNetwork(stats) {
  const networks = stats.networks || {};
  let rx = 0;
  let tx = 0;
  for (const iface of Object.values(networks)) {
    rx += iface.rx_bytes || 0;
    tx += iface.tx_bytes || 0;
  }
  return { rx, tx };
}

export function computeBlockIO(stats) {
  const entries = stats.blkio_stats?.io_service_bytes_recursive || [];
  let read = 0;
  let write = 0;
  for (const e of entries) {
    const op = (e.op || "").toLowerCase();
    if (op === "read") read += e.value;
    if (op === "write") write += e.value;
  }
  return { read, write };
}

export function summarizeStats(stats) {
  const mem = computeMemory(stats);
  const net = computeNetwork(stats);
  const block = computeBlockIO(stats);
  return {
    cpuPercent: computeCpuPercent(stats),
    memUsage: mem.usage,
    memLimit: mem.limit,
    memPercent: mem.percent,
    netRx: net.rx,
    netTx: net.tx,
    blockRead: block.read,
    blockWrite: block.write,
    pids: stats.pids_stats?.current || 0,
  };
}
