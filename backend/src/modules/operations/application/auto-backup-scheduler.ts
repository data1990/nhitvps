import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../../../config/env.js";
import { assertDatabaseIdentifier } from "../../database/domain/database.validators.js";
import { DatabaseBackupService, type DatabaseBackupResult } from "../../database/index.js";

export type AutoBackupDatabaseService = Pick<DatabaseBackupService, "backupDatabase">;

export type AutoBackupSchedulerOptions = {
  enabled: boolean;
  databaseNames: readonly string[];
  intervalMinutes: number;
  retentionDays: number;
  backupDir: string;
  nginxSitesAvailableDir: string;
};

export type AutoBackupRunResult = {
  startedAt: string;
  completedAt: string;
  databaseBackups: DatabaseBackupResult[];
  nginxConfigBackupPath: string | null;
  prunedPaths: string[];
};

export class AutoBackupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly options: AutoBackupSchedulerOptions;

  public constructor(
    private readonly databaseBackupService: AutoBackupDatabaseService = new DatabaseBackupService(),
    options: Partial<AutoBackupSchedulerOptions> = {},
  ) {
    this.options = {
      enabled: options.enabled ?? env.AUTO_BACKUP_ENABLED,
      databaseNames: options.databaseNames ?? env.AUTO_BACKUP_DATABASES,
      intervalMinutes: options.intervalMinutes ?? env.AUTO_BACKUP_INTERVAL_MINUTES,
      retentionDays: options.retentionDays ?? env.AUTO_BACKUP_RETENTION_DAYS,
      backupDir: path.resolve(options.backupDir ?? env.AUTO_BACKUP_DIR),
      nginxSitesAvailableDir: path.resolve(options.nginxSitesAvailableDir ?? env.NGINX_SITES_AVAILABLE_DIR),
    };

    for (const databaseName of this.options.databaseNames) {
      assertDatabaseIdentifier(databaseName, "database name");
    }
  }

  public start(): void {
    if (!this.options.enabled || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.options.intervalMinutes * 60 * 1000);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runOnce(): Promise<AutoBackupRunResult> {
    if (this.running) {
      throw new Error("Auto backup is already running");
    }

    this.running = true;
    const startedAt = new Date().toISOString();

    try {
      await fs.mkdir(this.options.backupDir, { recursive: true });
      const databaseBackups: DatabaseBackupResult[] = [];

      for (const databaseName of this.options.databaseNames) {
        databaseBackups.push(await this.databaseBackupService.backupDatabase({ databaseName }));
      }

      const nginxConfigBackupPath = await this.backupNginxConfig(startedAt);
      const prunedPaths = await this.pruneExpiredBackups();

      return {
        startedAt,
        completedAt: new Date().toISOString(),
        databaseBackups,
        nginxConfigBackupPath,
        prunedPaths,
      };
    } finally {
      this.running = false;
    }
  }

  private async backupNginxConfig(startedAt: string): Promise<string | null> {
    if (!(await pathExists(this.options.nginxSitesAvailableDir))) {
      return null;
    }

    const targetPath = path.join(this.options.backupDir, `nginx-config-${toFileTimestamp(startedAt)}`);
    await fs.cp(this.options.nginxSitesAvailableDir, targetPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    return targetPath;
  }

  private async pruneExpiredBackups(): Promise<string[]> {
    const cutoff = Date.now() - this.options.retentionDays * 24 * 60 * 60 * 1000;
    const prunedPaths: string[] = [];

    for (const entry of await fs.readdir(this.options.backupDir, { withFileTypes: true })) {
      const entryPath = path.join(this.options.backupDir, entry.name);
      const stat = await fs.stat(entryPath);

      if (stat.mtime.getTime() >= cutoff) {
        continue;
      }

      await fs.rm(entryPath, { recursive: true, force: true });
      prunedPaths.push(entryPath);
    }

    return prunedPaths;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toFileTimestamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}
