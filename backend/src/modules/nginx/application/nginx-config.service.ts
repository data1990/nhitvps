import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { NginxSiteConfig, RenderedNginxVhost } from "../domain/nginx.types.js";
import { renderNginxVhost } from "./nginx-vhost.renderer.js";

export type NginxConfigPaths = {
  sitesAvailableDir: string;
  sitesEnabledDir: string;
  backupDir: string;
};

export type CreateVhostResult = {
  fileName: string;
  availablePath: string;
  enabledPath: string;
  backupPath: string | null;
  content: string;
};

export class NginxConfigService {
  private readonly paths: NginxConfigPaths;

  public constructor(paths: Partial<NginxConfigPaths> = {}) {
    this.paths = {
      sitesAvailableDir: path.resolve(paths.sitesAvailableDir ?? env.NGINX_SITES_AVAILABLE_DIR),
      sitesEnabledDir: path.resolve(paths.sitesEnabledDir ?? env.NGINX_SITES_ENABLED_DIR),
      backupDir: path.resolve(paths.backupDir ?? env.NGINX_BACKUP_DIR),
    };
  }

  public async createOrUpdateVhost(config: NginxSiteConfig): Promise<CreateVhostResult> {
    const rendered = renderNginxVhost(config);
    const targetPath = this.resolveConfigPath(this.paths.sitesAvailableDir, rendered.fileName);
    const enabledPath = this.resolveConfigPath(this.paths.sitesEnabledDir, rendered.fileName);

    await fs.mkdir(this.paths.sitesAvailableDir, { recursive: true });
    await fs.mkdir(this.paths.sitesEnabledDir, { recursive: true });
    await fs.mkdir(this.paths.backupDir, { recursive: true });

    const backupPath = await this.backupIfExists(targetPath, rendered.fileName);
    await writeFileAtomically(targetPath, rendered.content);
    await fs.copyFile(targetPath, enabledPath);

    return {
      fileName: rendered.fileName,
      availablePath: targetPath,
      enabledPath,
      backupPath,
      content: rendered.content,
    };
  }

  private async backupIfExists(targetPath: string, fileName: string): Promise<string | null> {
    if (!(await pathExists(targetPath))) {
      return null;
    }

    const backupName = `${new Date().toISOString().replace(/[:.]/g, "-")}.${fileName}`;
    const backupPath = this.resolveConfigPath(this.paths.backupDir, backupName);
    await fs.copyFile(targetPath, backupPath);
    return backupPath;
  }

  private resolveConfigPath(baseDir: string, fileName: string): string {
    if (!/^[A-Za-z0-9.*_-]+\.conf$/.test(fileName)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid Nginx config file name",
        statusCode: 400,
      });
    }

    const targetPath = path.resolve(baseDir, fileName);

    if (!isInsideDirectory(baseDir, targetPath)) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Nginx config path is outside target directory",
        statusCode: 403,
      });
    }

    return targetPath;
  }
}

function isInsideDirectory(baseDir: string, targetPath: string): boolean {
  const relative = path.relative(baseDir, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function writeFileAtomically(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, targetPath);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

