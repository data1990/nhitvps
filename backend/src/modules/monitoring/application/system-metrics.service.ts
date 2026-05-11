import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";

export type CpuMetric = {
  cores: number;
  model: string;
  loadAverage: number[];
  usage: {
    user: number;
    nice: number;
    sys: number;
    idle: number;
    irq: number;
  };
};

export type MemoryMetric = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
};

export type DiskMetric = {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
};

export type NetworkInterfaceMetric = {
  name: string;
  addresses: string[];
  rxBytes: number | null;
  txBytes: number | null;
};

export type ProcessMetric = {
  pid: number;
  uptimeSeconds: number;
  memoryRssBytes: number;
  memoryHeapUsedBytes: number;
  activeHandles: number | null;
  topProcesses: Array<{
    pid: number;
    name: string;
    state: string;
    memoryRssBytes: number;
  }>;
};

export type DockerMetric = {
  available: boolean;
  socketPath: string;
  reason: string | null;
};

export type SystemMetricsSnapshot = {
  timestamp: string;
  hostname: string;
  platform: NodeJS.Platform;
  uptimeSeconds: number;
  cpu: CpuMetric;
  memory: MemoryMetric;
  disks: DiskMetric[];
  network: NetworkInterfaceMetric[];
  process: ProcessMetric;
  docker: DockerMetric;
};

export type SystemMetricsOptions = {
  diskPaths: readonly string[];
  dockerSocketPath: string;
  procRoot: string;
};

export class SystemMetricsService {
  private readonly options: SystemMetricsOptions;

  constructor(options: Partial<SystemMetricsOptions> = {}) {
    this.options = {
      diskPaths: options.diskPaths ?? env.MONITOR_DISK_PATHS,
      dockerSocketPath: options.dockerSocketPath ?? env.DOCKER_SOCKET_PATH,
      procRoot: options.procRoot ?? "/proc",
    };
  }

  async snapshot(): Promise<SystemMetricsSnapshot> {
    const [disks, networkStats, topProcesses, docker] = await Promise.all([
      this.diskMetrics(),
      this.networkStats(),
      this.topProcesses(),
      this.dockerMetric(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: process.platform,
      uptimeSeconds: os.uptime(),
      cpu: this.cpuMetric(),
      memory: this.memoryMetric(),
      disks,
      network: this.networkMetrics(networkStats),
      process: {
        pid: process.pid,
        uptimeSeconds: process.uptime(),
        memoryRssBytes: process.memoryUsage().rss,
        memoryHeapUsedBytes: process.memoryUsage().heapUsed,
        activeHandles: activeHandleCount(),
        topProcesses,
      },
      docker,
    };
  }

  private cpuMetric(): CpuMetric {
    const cpus = os.cpus();
    const usage = cpus.reduce(
      (total, cpu) => ({
        user: total.user + cpu.times.user,
        nice: total.nice + cpu.times.nice,
        sys: total.sys + cpu.times.sys,
        idle: total.idle + cpu.times.idle,
        irq: total.irq + cpu.times.irq,
      }),
      { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    );

    return {
      cores: cpus.length,
      model: cpus[0]?.model ?? "unknown",
      loadAverage: os.loadavg(),
      usage,
    };
  }

  private memoryMetric(): MemoryMetric {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(totalBytes - freeBytes, 0);

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent: percent(usedBytes, totalBytes),
    };
  }

  private async diskMetrics(): Promise<DiskMetric[]> {
    const metrics: DiskMetric[] = [];

    for (const diskPath of this.options.diskPaths) {
      const resolvedPath = path.resolve(diskPath);

      try {
        const stat = await fs.statfs(resolvedPath);
        const totalBytes = stat.blocks * stat.bsize;
        const freeBytes = stat.bavail * stat.bsize;
        const usedBytes = Math.max(totalBytes - freeBytes, 0);

        metrics.push({
          path: resolvedPath,
          totalBytes,
          freeBytes,
          usedBytes,
          usedPercent: percent(usedBytes, totalBytes),
        });
      } catch (error) {
        throw new AppError({
          code: "MONITOR_DISK_READ_FAILED",
          message: "Failed to read disk metrics",
          statusCode: 500,
          details: {
            path: resolvedPath,
            error: error instanceof Error ? error.message : "unknown",
          },
        });
      }
    }

    return metrics;
  }

  private networkMetrics(stats: Map<string, { rxBytes: number; txBytes: number }>): NetworkInterfaceMetric[] {
    return Object.entries(os.networkInterfaces())
      .map(([name, addresses]) => ({
        name,
        addresses: (addresses ?? []).map((address) => address.address),
        rxBytes: stats.get(name)?.rxBytes ?? null,
        txBytes: stats.get(name)?.txBytes ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private async networkStats(): Promise<Map<string, { rxBytes: number; txBytes: number }>> {
    const filePath = path.join(this.options.procRoot, "net", "dev");
    const stats = new Map<string, { rxBytes: number; txBytes: number }>();

    try {
      const content = await fs.readFile(filePath, "utf8");

      for (const line of content.split("\n").slice(2)) {
        const [rawName, rawValues] = line.split(":");

        if (!rawName || !rawValues) {
          continue;
        }

        const values = rawValues.trim().split(/\s+/).map(Number);
        const rxBytes = values[0];
        const txBytes = values[8];

        if (typeof rxBytes === "number" && typeof txBytes === "number" && Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
          stats.set(rawName.trim(), { rxBytes, txBytes });
        }
      }
    } catch {
      return stats;
    }

    return stats;
  }

  private async topProcesses(): Promise<ProcessMetric["topProcesses"]> {
    let entries: string[];

    try {
      entries = await fs.readdir(this.options.procRoot);
    } catch {
      return [];
    }

    const processes: ProcessMetric["topProcesses"] = [];

    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) {
        continue;
      }

      const stat = await this.readProcessStat(Number(entry));

      if (stat) {
        processes.push(stat);
      }
    }

    return processes.sort((left, right) => right.memoryRssBytes - left.memoryRssBytes).slice(0, 10);
  }

  private async readProcessStat(pid: number): Promise<ProcessMetric["topProcesses"][number] | null> {
    try {
      const stat = await fs.readFile(path.join(this.options.procRoot, String(pid), "stat"), "utf8");
      const status = await fs.readFile(path.join(this.options.procRoot, String(pid), "status"), "utf8");
      const match = /^(\d+)\s+\((.*)\)\s+([A-Z])/.exec(stat);

      if (!match) {
        return null;
      }

      return {
        pid,
        name: match[2] ?? "unknown",
        state: match[3] ?? "?",
        memoryRssBytes: rssBytesFromStatus(status),
      };
    } catch {
      return null;
    }
  }

  private async dockerMetric(): Promise<DockerMetric> {
    try {
      const stat = await fs.stat(this.options.dockerSocketPath);

      return {
        available: stat.isSocket(),
        socketPath: this.options.dockerSocketPath,
        reason: stat.isSocket() ? null : "Path exists but is not a socket",
      };
    } catch {
      return {
        available: false,
        socketPath: this.options.dockerSocketPath,
        reason: "Docker socket not found",
      };
    }
  }
}

function rssBytesFromStatus(status: string): number {
  const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
  return match ? Number(match[1]) * 1024 : 0;
}

function percent(used: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Number(((used / total) * 100).toFixed(2));
}

function activeHandleCount(): number | null {
  const processWithHandles = process as typeof process & {
    _getActiveHandles?: () => unknown[];
  };

  return processWithHandles._getActiveHandles?.().length ?? null;
}
