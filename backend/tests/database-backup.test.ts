import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseBackupService, type DatabaseBackupCommandExecutor } from "../src/modules/database/index.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";

describe("database backup service", () => {
  let tempRoot: string;
  let backupDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-db-backup-"));
    backupDir = path.join(tempRoot, "backups");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("backs up a database through mysqldump policy and computes checksum", async () => {
    const dump = "CREATE DATABASE `app_db`;\n";
    const executor = new RecordingBackupExecutor(dump);
    const service = new DatabaseBackupService(executor, {
      backupDir,
      mysqlHost: "127.0.0.1",
      mysqlPort: 3306,
      mysqlUser: "root",
      mysqlPassword: "super-secret",
    });

    const result = await service.backupDatabase({
      databaseName: "app_db",
    });

    expect(result.databaseName).toBe("app_db");
    expect(result.checksumSha256).toBe(createHash("sha256").update(dump).digest("hex"));
    expect(await fs.readFile(result.backupPath, "utf8")).toBe(dump);
    expect(executor.requests[0]?.policyId).toBe("mysqldump:database");
    expect(executor.requests[0]?.args).toContain("--databases");
    expect(executor.requests[0]?.args).toContain("app_db");
    expect(JSON.stringify(executor.requests[0]?.args)).not.toContain("super-secret");
  });

  it("restores a backup only when checksum matches", async () => {
    const sql = "CREATE DATABASE `restore_db`;\n";
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, "restore.sql");
    await fs.writeFile(backupPath, sql, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const executor = new RecordingBackupExecutor("");
    const service = new DatabaseBackupService(executor, {
      backupDir,
      mysqlHost: "127.0.0.1",
      mysqlPort: 3306,
      mysqlUser: "root",
      mysqlPassword: "super-secret",
    });

    const result = await service.restoreDatabase({
      backupPath,
      checksumSha256: checksum,
    });

    expect(result.checksumSha256).toBe(checksum);
    expect(executor.requests[0]?.policyId).toBe("mysql:restore");
    expect(executor.requests[0]?.stdin).toBe(sql);
    expect(JSON.stringify(executor.requests[0]?.args)).not.toContain("super-secret");
  });

  it("rejects unsafe database names and checksum mismatch", async () => {
    const executor = new RecordingBackupExecutor("");
    const service = new DatabaseBackupService(executor, {
      backupDir,
      mysqlHost: "127.0.0.1",
      mysqlPort: 3306,
      mysqlUser: "root",
      mysqlPassword: "",
    });

    await expect(service.backupDatabase({ databaseName: "app;drop" })).rejects.toThrowError(
      "database name must use letters, numbers, and underscores only",
    );

    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, "restore.sql");
    await fs.writeFile(backupPath, "SELECT 1;\n", "utf8");

    await expect(
      service.restoreDatabase({
        backupPath,
        checksumSha256: "0".repeat(64),
      }),
    ).rejects.toThrowError("Backup checksum does not match");
    expect(executor.requests).toHaveLength(0);
  });
});

class RecordingBackupExecutor implements DatabaseBackupCommandExecutor {
  readonly requests: CommandRequest[] = [];

  constructor(private readonly stdout: string) {}

  async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(request);

    return {
      policyId: request.policyId,
      binary: request.policyId,
      args: request.args ?? [],
      exitCode: 0,
      signal: null,
      stdout: this.stdout,
      stderr: "",
      durationMs: 1,
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
}
