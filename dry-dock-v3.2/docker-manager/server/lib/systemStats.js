import os from "os";
import fs from "fs";

// Node's os module (and /proc directly) reflect the HOST's real values
// inside a standard Docker container, not a cgroup-limited view — Docker
// doesn't virtualize /proc/stat or /proc/meminfo by default. That's what
// makes this possible without a separate host agent or cAdvisor: as long
// as this code is actually running on the node in question (true for
// "local" and for a node reached through a Dry Dock Agent), the numbers
// are real system-wide figures, not just this container's own usage.

let prevCpuSnapshot = null;

function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function getSwapInfo() {
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf-8");
    const totalKb = Number(meminfo.match(/SwapTotal:\s+(\d+)/)?.[1] || 0);
    const freeKb = Number(meminfo.match(/SwapFree:\s+(\d+)/)?.[1] || 0);
    const total = totalKb * 1024;
    const free = freeKb * 1024;
    return { total, used: Math.max(0, total - free) };
  } catch {
    return { total: 0, used: 0 };
  }
}

function getDiskInfo(path = "/") {
  try {
    const stats = fs.statfsSync(path);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return { total, used: Math.max(0, total - free) };
  } catch {
    return { total: 0, used: 0 };
  }
}

function pct(used, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

// CPU percent needs two samples over time to be meaningful (it's a delta
// of cumulative counters) — the first call after boot returns 0, which is
// fine since the Monitoring page polls this every few seconds anyway.
export function getSystemStats() {
  const current = cpuSnapshot();
  let cpuPercent = 0;
  if (prevCpuSnapshot) {
    const idleDelta = current.idle - prevCpuSnapshot.idle;
    const totalDelta = current.total - prevCpuSnapshot.total;
    cpuPercent = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;
  }
  prevCpuSnapshot = current;

  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = Math.max(0, memTotal - memFree);

  const swap = getSwapInfo();
  const disk = getDiskInfo("/");

  return {
    cpuPercent: Math.max(0, Math.min(100, cpuPercent)),
    memPercent: pct(memUsed, memTotal),
    memUsed,
    memTotal,
    swapPercent: pct(swap.used, swap.total),
    swapUsed: swap.used,
    swapTotal: swap.total,
    diskPercent: pct(disk.used, disk.total),
    diskUsed: disk.used,
    diskTotal: disk.total,
  };
}
