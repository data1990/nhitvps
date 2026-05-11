import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutoBackupScheduler, type AutoBackupDatabaseService } from "../src/modules/operations/index.js";

describe("auto backup scheduler", () => {
  let tempRoot: string;
  let autoBackupDir: string;
  let nginxConfigDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-auto-backup-"));
    autoBackupDir = path.join(tempRoot, "auto");
    nginxConfigDir = path.join(tempRoot, "nginx-sites");
    await fs.mkdir(nginxConfigDir, { recursive: true });
    await fs.writeFile(path.join(nginxConfigDir, "example.com.conf"), "server {}", "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("backs up configured databases and nginx config", async () => {
    const databaseService = createFakeDatabaseBackupService(autoBackupDir);
    const scheduler = new AutoBackupScheduler(databaseService, {
      enabled: true,
      databaseNames: ["app_db"],
      intervalMinutes: 60,
      retentionDays: 14,
      backupDir: autoBackupDir,
      nginxSitesAvailableDir: nginxConfigDir,
    });

    const result = await scheduler.runOnce();

    expect(result.databaseBackups).toHaveLength(1);
    expect(result.databaseBackups[0]?.databaseName).toBe("app_db");
    expect(result.nginxConfigBackupPath).toBeTruthy();
    await expect(fs.access(path.join(result.nginxConfigBackupPath!, "example.com.conf"))).resolves.toBeUndefined();
  });

  it("prunes expired backup entries inside the auto backup directory", async () => {
    const oldPath = path.join(autoBackupDir, "old-backup");
    await fs.mkdir(autoBackupDir, { recursive: true });
    await fs.writeFile(oldPath, "old", "utf8");
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldPath, oldDate, oldDate);

    const scheduler = new AutoBackupScheduler(createFakeDatabaseBackupService(autoBackupDir), {
      enabled: true,
      databaseNames: [],
      intervalMinutes: 60,
      retentionDays: 1,
      backupDir: autoBackupDir,
      nginxSitesAvailableDir: path.join(tempRoot, "missing-nginx"),
    });

    const result = await scheduler.runOnce();

    expect(result.prunedPaths).toContain(oldPath);
    await expect(fs.access(oldPath)).rejects.toThrow();
  });
});

function createFakeDatabaseBackupService(backupDir: string): AutoBackupDatabaseService {
  return {
    async backupDatabase(input) {
      await fs.mkdir(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, `${input.databaseName}.sql`);
      await fs.writeFile(backupPath, "-- fake backup", "utf8");

      return {
        databaseName: input.databaseName,
        backupPath,
        checksumSha256: "0".repeat(64),
        sizeBytes: 14,
        createdAt: new Date().toISOString(),
      };
    },
  };
}
