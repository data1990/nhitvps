import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../../../config/env.js";
import { PathSandbox } from "../../../security/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { DatabaseBackupService, type DatabaseRestoreResult } from "../../database/index.js";

export type RollbackDatabaseService = Pick<DatabaseBackupService, "restoreDatabase">;

export type RollbackManagerOptions = {
  databaseBackupDir: string;
  nginxBackupDir: string;
  nginxSitesAvailableDir: string;
  nginxSitesEnabledDir: string;
  rollbackBackupDir: string;
  auditLogPath: string;
};

export type RollbackAuditEvent = {
  action: "database_restore" | "nginx_config_restore";
  actor: string;
  target: string;
  result: "success";
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type NginxRollbackResult = {
  backupPath: string;
  restoredPath: string;
  enabledPath: string | null;
  preRollbackBackupPath: string | null;
  restoredAt: string;
};

export class RollbackManager {
  private readonly options: RollbackManagerOptions;
  private readonly databaseBackupSandbox: PathSandbox;
  private readonly nginxBackupSandbox: PathSandbox;

  public constructor(
    private readonly databaseService: RollbackDatabaseService = new DatabaseBackupService(),
    options: Partial<RollbackManagerOptions> = {},
  ) {
    this.options = {
      databaseBackupDir: path.resolve(options.databaseBackupDir ?? env.DATABASE_BACKUP_DIR),
      nginxBackupDir: path.resolve(options.nginxBackupDir ?? env.NGINX_BACKUP_DIR),
      nginxSitesAvailableDir: path.resolve(options.nginxSitesAvailableDir ?? env.NGINX_SITES_AVAILABLE_DIR),
      nginxSitesEnabledDir: path.resolve(options.nginxSitesEnabledDir ?? env.NGINX_SITES_ENABLED_DIR),
      rollbackBackupDir: path.resolve(options.rollbackBackupDir ?? path.join(env.AUTO_BACKUP_DIR, "pre-rollback")),
      auditLogPath: path.resolve(options.auditLogPath ?? path.join(env.AUTO_BACKUP_DIR, "rollback-audit.jsonl")),
    };
    this.databaseBackupSandbox = new PathSandbox([this.options.databaseBackupDir]);
    this.nginxBackupSandbox = new PathSandbox([this.options.nginxBackupDir]);
  }

  public async restoreDatabase(input: {
    actor: string;
    backupPath: string;
    checksumSha256?: string;
  }): Promise<DatabaseRestoreResult> {
    const backup = await this.databaseBackupSandbox.resolveExisting(input.backupPath);
    const result = await this.databaseService.restoreDatabase({
      backupPath: backup.resolvedPath,
      checksumSha256: input.checksumSha256,
    });

    await this.audit({
      action: "database_restore",
      actor: input.actor,
      target: backup.resolvedPath,
      result: "success",
      createdAt: result.restoredAt,
      metadata: {
        checksumSha256: result.checksumSha256,
        sizeBytes: result.sizeBytes,
      },
    });

    return result;
  }

  public async restoreNginxConfig(input: { actor: string; backupPath: string }): Promise<NginxRollbackResult> {
    const backup = await this.nginxBackupSandbox.resolveExisting(input.backupPath);
    const stat = await fs.stat(backup.resolvedPath);
    await fs.mkdir(this.options.nginxSitesAvailableDir, { recursive: true });
    await fs.mkdir(this.options.nginxSitesEnabledDir, { recursive: true });
    await fs.mkdir(this.options.rollbackBackupDir, { recursive: true });

    if (stat.isDirectory()) {
      return await this.restoreNginxConfigDirectory(input.actor, backup.resolvedPath);
    }

    if (!stat.isFile() || !backup.resolvedPath.endsWith(".conf")) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Nginx rollback backup must be a .conf file or config directory",
        statusCode: 400,
      });
    }

    return await this.restoreNginxConfigFile(input.actor, backup.resolvedPath);
  }

  private async restoreNginxConfigFile(actor: string, backupPath: string): Promise<NginxRollbackResult> {
    const fileName = path.basename(backupPath);
    const restoredPath = this.resolveNginxTarget(this.options.nginxSitesAvailableDir, fileName);
    const enabledPath = this.resolveNginxTarget(this.options.nginxSitesEnabledDir, fileName);
    const preRollbackBackupPath = await this.backupExistingPath(restoredPath);

    await fs.copyFile(backupPath, restoredPath);
    await fs.copyFile(restoredPath, enabledPath);

    const restoredAt = new Date().toISOString();
    await this.audit({
      action: "nginx_config_restore",
      actor,
      target: restoredPath,
      result: "success",
      createdAt: restoredAt,
      metadata: {
        backupPath,
        enabledPath,
        preRollbackBackupPath,
      },
    });

    return {
      backupPath,
      restoredPath,
      enabledPath,
      preRollbackBackupPath,
      restoredAt,
    };
  }

  private async restoreNginxConfigDirectory(actor: string, backupPath: string): Promise<NginxRollbackResult> {
    const preRollbackBackupPath = await this.backupExistingPath(this.options.nginxSitesAvailableDir);
    await fs.cp(backupPath, this.options.nginxSitesAvailableDir, {
      recursive: true,
      force: true,
    });

    const restoredAt = new Date().toISOString();
    await this.audit({
      action: "nginx_config_restore",
      actor,
      target: this.options.nginxSitesAvailableDir,
      result: "success",
      createdAt: restoredAt,
      metadata: {
        backupPath,
        enabledPath: null,
        preRollbackBackupPath,
      },
    });

    return {
      backupPath,
      restoredPath: this.options.nginxSitesAvailableDir,
      enabledPath: null,
      preRollbackBackupPath,
      restoredAt,
    };
  }

  private resolveNginxTarget(baseDir: string, fileName: string): string {
    if (!/^[A-Za-z0-9.*_-]+\.conf$/.test(fileName)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid Nginx config file name",
        statusCode: 400,
      });
    }

    const targetPath = path.resolve(baseDir, fileName);
    const relative = path.relative(baseDir, targetPath);

    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Nginx rollback target is outside config directory",
        statusCode: 403,
      });
    }

    return targetPath;
  }

  private async backupExistingPath(targetPath: string): Promise<string | null> {
    if (!(await pathExists(targetPath))) {
      return null;
    }

    const backupPath = path.join(this.options.rollbackBackupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${path.basename(targetPath)}`);
    await fs.cp(targetPath, backupPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    return backupPath;
  }

  private async audit(event: RollbackAuditEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.options.auditLogPath), { recursive: true });
    await fs.appendFile(this.options.auditLogPath, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
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
