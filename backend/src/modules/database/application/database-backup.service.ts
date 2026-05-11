import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../../../config/env.js";
import { CommandRunner, type CommandPolicy, type CommandRequest, type CommandResult } from "../../../infrastructure/command/index.js";
import { PathSandbox } from "../../../security/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { assertBackupChecksum, assertDatabaseIdentifier } from "../domain/database.validators.js";

export interface DatabaseBackupCommandExecutor {
  run(request: CommandRequest): Promise<CommandResult>;
}

export type DatabaseBackupOptions = {
  backupDir: string;
  mysqlHost: string;
  mysqlPort: number;
  mysqlUser: string;
  mysqlPassword: string;
};

export type DatabaseBackupResult = {
  databaseName: string;
  backupPath: string;
  checksumSha256: string;
  sizeBytes: number;
  createdAt: string;
};

export type DatabaseRestoreResult = {
  backupPath: string;
  checksumSha256: string;
  sizeBytes: number;
  restoredAt: string;
};

export class DatabaseBackupService {
  private readonly options: DatabaseBackupOptions;
  private readonly sandbox: PathSandbox;

  constructor(
    private readonly commandExecutor: DatabaseBackupCommandExecutor = createDefaultDatabaseBackupCommandRunner(),
    options: Partial<DatabaseBackupOptions> = {},
  ) {
    this.options = {
      backupDir: options.backupDir ?? env.DATABASE_BACKUP_DIR,
      mysqlHost: options.mysqlHost ?? env.MYSQL_HOST,
      mysqlPort: options.mysqlPort ?? env.MYSQL_PORT,
      mysqlUser: options.mysqlUser ?? env.MYSQL_ADMIN_USER,
      mysqlPassword: options.mysqlPassword ?? env.MYSQL_ADMIN_PASSWORD,
    };
    this.sandbox = new PathSandbox([this.options.backupDir]);
  }

  async backupDatabase(input: { databaseName: string }): Promise<DatabaseBackupResult> {
    assertDatabaseIdentifier(input.databaseName, "database name");
    await fs.mkdir(this.options.backupDir, { recursive: true });

    const createdAt = new Date().toISOString();
    const backupPath = path.join(this.options.backupDir, `${input.databaseName}-${toFileTimestamp(createdAt)}.sql`);
    const defaultsFile = await this.createDefaultsFile();

    try {
      const result = await this.commandExecutor.run({
        policyId: "mysqldump:database",
        args: [
          `--defaults-extra-file=${toCommandPath(defaultsFile)}`,
          "--single-transaction",
          "--skip-lock-tables",
          "--routines",
          "--triggers",
          "--databases",
          input.databaseName,
        ],
      });

      await fs.writeFile(backupPath, result.stdout, { encoding: "utf8", mode: 0o600 });
      const metadata = await fileMetadata(backupPath);

      return {
        databaseName: input.databaseName,
        backupPath,
        checksumSha256: metadata.checksumSha256,
        sizeBytes: metadata.sizeBytes,
        createdAt,
      };
    } finally {
      await cleanupDefaultsFile(defaultsFile);
    }
  }

  async restoreDatabase(input: { backupPath: string; checksumSha256?: string }): Promise<DatabaseRestoreResult> {
    const backup = await this.sandbox.resolveExisting(input.backupPath);
    const metadata = await fileMetadata(backup.resolvedPath);

    if (input.checksumSha256 !== undefined) {
      assertBackupChecksum(input.checksumSha256);

      if (metadata.checksumSha256.toLowerCase() !== input.checksumSha256.toLowerCase()) {
        throw new AppError({
          code: "BACKUP_CHECKSUM_MISMATCH",
          message: "Backup checksum does not match",
          statusCode: 400,
        });
      }
    }

    const defaultsFile = await this.createDefaultsFile();

    try {
      await this.commandExecutor.run({
        policyId: "mysql:restore",
        args: [`--defaults-extra-file=${toCommandPath(defaultsFile)}`],
        stdin: await fs.readFile(backup.resolvedPath, "utf8"),
      });

      return {
        backupPath: backup.resolvedPath,
        checksumSha256: metadata.checksumSha256,
        sizeBytes: metadata.sizeBytes,
        restoredAt: new Date().toISOString(),
      };
    } finally {
      await cleanupDefaultsFile(defaultsFile);
    }
  }

  private async createDefaultsFile(): Promise<string> {
    validateClientOption("mysqlHost", this.options.mysqlHost);
    validateClientOption("mysqlUser", this.options.mysqlUser);
    validateClientOption("mysqlPassword", this.options.mysqlPassword);
    await fs.mkdir(this.options.backupDir, { recursive: true });

    const tempDir = await fs.mkdtemp(path.join(this.options.backupDir, ".mysql-client-"));
    const defaultsFile = path.join(tempDir, "client.cnf");
    const content = [
      "[client]",
      `host=${this.options.mysqlHost}`,
      `port=${this.options.mysqlPort}`,
      `user=${this.options.mysqlUser}`,
      `password=${this.options.mysqlPassword}`,
      "",
    ].join("\n");

    await fs.writeFile(defaultsFile, content, { encoding: "utf8", mode: 0o600 });
    return defaultsFile;
  }
}

export function createDefaultDatabaseBackupCommandRunner(): CommandRunner {
  return new CommandRunner(createDatabaseBackupCommandPolicies());
}

export function createDatabaseBackupCommandPolicies(): CommandPolicy[] {
  const argPattern = /^[A-Za-z0-9._:/=@,+%-]+$/;

  return [
    {
      id: "mysqldump:database",
      binary: env.MYSQLDUMP_BINARY,
      argPattern,
      timeoutMs: env.DATABASE_BACKUP_TIMEOUT_MS,
      maxArgs: 8,
      maxOutputBytes: env.DATABASE_BACKUP_MAX_BYTES,
    },
    {
      id: "mysql:restore",
      binary: env.MYSQL_CLIENT_BINARY,
      argPattern,
      timeoutMs: env.DATABASE_RESTORE_TIMEOUT_MS,
      maxArgs: 1,
      maxOutputBytes: 512 * 1024,
    },
  ];
}

async function fileMetadata(filePath: string): Promise<{ checksumSha256: string; sizeBytes: number }> {
  const content = await fs.readFile(filePath);
  const stat = await fs.stat(filePath);

  return {
    checksumSha256: createHash("sha256").update(content).digest("hex"),
    sizeBytes: stat.size,
  };
}

async function cleanupDefaultsFile(defaultsFile: string): Promise<void> {
  await fs.rm(path.dirname(defaultsFile), { recursive: true, force: true });
}

function toFileTimestamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function toCommandPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function validateClientOption(name: string, value: string): void {
  if (/[\r\n\0]/.test(value)) {
    throw new AppError({
      code: "CONFIG_ERROR",
      message: `${name} contains unsafe characters`,
      statusCode: 500,
    });
  }
}
