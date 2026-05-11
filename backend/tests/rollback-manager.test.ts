import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RollbackManager, type RollbackDatabaseService } from "../src/modules/operations/index.js";

let tempRoot: string;
let databaseBackupDir: string;
let nginxBackupDir: string;
let sitesAvailableDir: string;
let sitesEnabledDir: string;
let rollbackBackupDir: string;
let auditLogPath: string;

describe("rollback manager", () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-rollback-"));
    databaseBackupDir = path.join(tempRoot, "database-backups");
    nginxBackupDir = path.join(tempRoot, "nginx-backups");
    sitesAvailableDir = path.join(tempRoot, "sites-available");
    sitesEnabledDir = path.join(tempRoot, "sites-enabled");
    rollbackBackupDir = path.join(tempRoot, "pre-rollback");
    auditLogPath = path.join(tempRoot, "audit", "rollback.jsonl");
    await fs.mkdir(databaseBackupDir, { recursive: true });
    await fs.mkdir(nginxBackupDir, { recursive: true });
    await fs.mkdir(sitesAvailableDir, { recursive: true });
    await fs.mkdir(sitesEnabledDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("restores database backups through the database restore service and writes audit log", async () => {
    const backupPath = path.join(databaseBackupDir, "app.sql");
    await fs.writeFile(backupPath, "-- backup", "utf8");
    const manager = new RollbackManager(createFakeRestoreService(), rollbackOptions());

    const result = await manager.restoreDatabase({
      actor: "admin",
      backupPath,
      checksumSha256: "1".repeat(64),
    });

    expect(result.backupPath.toLowerCase()).toBe(backupPath.toLowerCase());
    const auditLog = await fs.readFile(auditLogPath, "utf8");
    expect(auditLog).toContain("database_restore");
    expect(auditLog).toContain("admin");
  });

  it("restores nginx config files and backs up current config before overwrite", async () => {
    const backupPath = path.join(nginxBackupDir, "example.com.conf");
    const targetPath = path.join(sitesAvailableDir, "example.com.conf");
    await fs.writeFile(backupPath, "server { listen 443; }", "utf8");
    await fs.writeFile(targetPath, "server { listen 80; }", "utf8");
    const manager = new RollbackManager(createFakeRestoreService(), rollbackOptions());

    const result = await manager.restoreNginxConfig({
      actor: "admin",
      backupPath,
    });

    expect(await fs.readFile(targetPath, "utf8")).toBe("server { listen 443; }");
    expect(await fs.readFile(path.join(sitesEnabledDir, "example.com.conf"), "utf8")).toBe("server { listen 443; }");
    expect(result.preRollbackBackupPath).toBeTruthy();
    await expect(fs.access(result.preRollbackBackupPath!)).resolves.toBeUndefined();
    expect(await fs.readFile(auditLogPath, "utf8")).toContain("nginx_config_restore");
  });
});

function rollbackOptions() {
  return {
    databaseBackupDir,
    nginxBackupDir,
    nginxSitesAvailableDir: sitesAvailableDir,
    nginxSitesEnabledDir: sitesEnabledDir,
    rollbackBackupDir,
    auditLogPath,
  };
}

function createFakeRestoreService(): RollbackDatabaseService {
  return {
    async restoreDatabase(input) {
      return {
        backupPath: input.backupPath,
        checksumSha256: input.checksumSha256 ?? "0".repeat(64),
        sizeBytes: 8,
        restoredAt: new Date().toISOString(),
      };
    },
  };
}
