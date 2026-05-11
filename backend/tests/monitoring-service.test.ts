import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SystemMetricsService } from "../src/modules/monitoring/index.js";

describe("system metrics service", () => {
  let tempRoot: string;
  let procRoot: string;
  let diskRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-monitoring-"));
    procRoot = path.join(tempRoot, "proc");
    diskRoot = path.join(tempRoot, "disk");
    await fs.mkdir(path.join(procRoot, "net"), { recursive: true });
    await fs.mkdir(path.join(procRoot, "123"), { recursive: true });
    await fs.mkdir(diskRoot, { recursive: true });
    await fs.writeFile(
      path.join(procRoot, "net", "dev"),
      [
        "Inter-|   Receive                                                |  Transmit",
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
        "  eth0: 1024 0 0 0 0 0 0 0 2048 0 0 0 0 0 0 0",
        "",
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(path.join(procRoot, "123", "stat"), "123 (node) S 1 1 1 0 0\n", "utf8");
    await fs.writeFile(path.join(procRoot, "123", "status"), "Name:\tnode\nVmRSS:\t4096 kB\n", "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("returns a system metrics snapshot without shell commands", async () => {
    const service = new SystemMetricsService({
      diskPaths: [diskRoot],
      procRoot,
      dockerSocketPath: path.join(tempRoot, "docker.sock"),
    });

    const snapshot = await service.snapshot();

    expect(snapshot.cpu.cores).toBeGreaterThan(0);
    expect(snapshot.memory.totalBytes).toBeGreaterThan(0);
    expect(snapshot.disks).toHaveLength(1);
    expect(snapshot.disks[0]?.path).toBe(path.resolve(diskRoot));
    const eth0 = snapshot.network.find((item) => item.name === "eth0");

    if (eth0) {
      expect(eth0.rxBytes).toBe(1024);
      expect(eth0.txBytes).toBe(2048);
    }
    expect(snapshot.process.topProcesses).toEqual([
      {
        pid: 123,
        name: "node",
        state: "S",
        memoryRssBytes: 4096 * 1024,
      },
    ]);
    expect(snapshot.docker).toMatchObject({
      available: false,
      reason: "Docker socket not found",
    });
  });
});
