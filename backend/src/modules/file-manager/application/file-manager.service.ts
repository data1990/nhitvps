import { promises as fs } from "node:fs";
import AdmZip from "adm-zip";
import path from "node:path";
import { env } from "../../../config/env.js";
import { PathSandbox } from "../../../security/index.js";
import { AppError } from "../../../shared/errors/app-error.js";

export type FileEntry = {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink" | "other";
  size: number;
  modifiedAt: string;
  mode: string;
};

export type FileManagerRoots = readonly string[];

export class FileManagerService {
  private readonly roots: string[];
  private readonly sandbox: PathSandbox;

  public constructor(
    roots: FileManagerRoots = env.FILE_MANAGER_ROOTS,
    private readonly maxReadBytes = env.FILE_MANAGER_MAX_READ_BYTES,
    private readonly maxWriteBytes = env.FILE_MANAGER_MAX_WRITE_BYTES,
    private readonly maxArchiveBytes = env.FILE_MANAGER_MAX_ARCHIVE_BYTES,
  ) {
    this.roots = roots.map((root) => path.resolve(root));
    this.sandbox = new PathSandbox(this.roots);
  }

  public listRoots(): { path: string; name: string }[] {
    return this.roots.map((root) => ({
      path: root,
      name: path.basename(root) || root,
    }));
  }

  public async listDirectory(input: { root?: string; targetPath?: string }): Promise<{
    root: string;
    path: string;
    entries: FileEntry[];
  }> {
    const root = this.resolveRoot(input.root);
    const target = await this.sandbox.resolveExisting(path.resolve(root, input.targetPath ?? "."));
    const stat = await fs.stat(target.resolvedPath);

    if (!stat.isDirectory()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Path is not a directory",
        statusCode: 400,
      });
    }

    const dirents = await fs.readdir(target.resolvedPath, { withFileTypes: true });
    const entries = await Promise.all(
      dirents.map(async (dirent) => {
        const entryPath = path.join(target.resolvedPath, dirent.name);
        const entryStat = await fs.lstat(entryPath);

        return {
          name: dirent.name,
          path: toRelativePath(root, entryPath),
          type: getEntryType(dirent),
          size: entryStat.size,
          modifiedAt: entryStat.mtime.toISOString(),
          mode: `0${(entryStat.mode & 0o777).toString(8)}`,
        } satisfies FileEntry;
      }),
    );

    entries.sort((left, right) => {
      if (left.type === "directory" && right.type !== "directory") {
        return -1;
      }

      if (left.type !== "directory" && right.type === "directory") {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });

    return {
      root,
      path: toRelativePath(root, target.resolvedPath),
      entries,
    };
  }

  public async readFile(input: { root?: string; targetPath: string }): Promise<{
    root: string;
    path: string;
    content: string;
    size: number;
    modifiedAt: string;
  }> {
    const root = this.resolveRoot(input.root);
    const target = await this.sandbox.resolveExisting(path.resolve(root, input.targetPath));
    const stat = await fs.stat(target.resolvedPath);

    if (!stat.isFile()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Path is not a file",
        statusCode: 400,
      });
    }

    if (stat.size > this.maxReadBytes) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "File is too large to read",
        statusCode: 413,
        details: {
          maxReadBytes: this.maxReadBytes,
          size: stat.size,
        },
      });
    }

    return {
      root,
      path: toRelativePath(root, target.resolvedPath),
      content: await fs.readFile(target.resolvedPath, "utf8"),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  public async getDownload(input: { root?: string; targetPath: string }): Promise<{
    absolutePath: string;
    fileName: string;
    size: number;
    modifiedAt: string;
  }> {
    const root = this.resolveRoot(input.root);
    const target = await this.sandbox.resolveExisting(path.resolve(root, input.targetPath));
    const stat = await fs.stat(target.resolvedPath);

    if (!stat.isFile()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Path is not a file",
        statusCode: 400,
      });
    }

    return {
      absolutePath: target.resolvedPath,
      fileName: path.basename(target.resolvedPath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  public async uploadFile(input: {
    root?: string;
    targetDirectory?: string;
    fileName: string;
    content: Buffer;
    overwrite?: boolean;
  }): Promise<{ root: string; path: string; size: number }> {
    if (input.content.byteLength > env.FILE_MANAGER_MAX_UPLOAD_BYTES) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Upload is too large",
        statusCode: 413,
      });
    }

    const safeFileName = sanitizeFileName(input.fileName);
    const root = this.resolveRoot(input.root);
    const directory = await this.sandbox.resolveExisting(path.resolve(root, input.targetDirectory ?? "."));
    const directoryStat = await fs.stat(directory.resolvedPath);

    if (!directoryStat.isDirectory()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Upload target is not a directory",
        statusCode: 400,
      });
    }

    const targetPath = path.join(directory.resolvedPath, safeFileName);
    this.sandbox.resolveFromRoot(root, path.relative(root, targetPath));

    if (!input.overwrite && (await pathExists(targetPath))) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "File already exists",
        statusCode: 409,
      });
    }

    await fs.writeFile(targetPath, input.content, {
      flag: input.overwrite ? "w" : "wx",
    });

    return {
      root,
      path: toRelativePath(root, targetPath),
      size: input.content.byteLength,
    };
  }

  public async writeTextFile(input: {
    root?: string;
    targetPath: string;
    content: string;
    overwrite?: boolean;
  }): Promise<{ root: string; path: string; size: number }> {
    const content = Buffer.from(input.content, "utf8");

    if (content.byteLength > this.maxWriteBytes) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Content is too large",
        statusCode: 413,
      });
    }

    const root = this.resolveRoot(input.root);
    const targetPath = await this.resolveWritableFile(root, input.targetPath);

    if (!input.overwrite && (await pathExists(targetPath))) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "File already exists",
        statusCode: 409,
      });
    }

    await fs.writeFile(targetPath, content, "utf8");

    return {
      root,
      path: toRelativePath(root, targetPath),
      size: content.byteLength,
    };
  }

  public async chmod(input: { root?: string; targetPath: string; mode: string }): Promise<{ path: string; mode: string }> {
    if (!/^[0-7]{3,4}$/.test(input.mode)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Mode must be a 3 or 4 digit octal string",
        statusCode: 400,
      });
    }

    const root = this.resolveRoot(input.root);
    const target = await this.sandbox.resolveExisting(path.resolve(root, input.targetPath));
    await fs.chmod(target.resolvedPath, Number.parseInt(input.mode, 8));

    return {
      path: toRelativePath(root, target.resolvedPath),
      mode: input.mode,
    };
  }

  public async chown(input: {
    root?: string;
    targetPath: string;
    uid?: number;
    gid?: number;
  }): Promise<{ path: string; uid?: number; gid?: number }> {
    if (input.uid === undefined && input.gid === undefined) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "uid or gid is required",
        statusCode: 400,
      });
    }

    const root = this.resolveRoot(input.root);
    const target = await this.sandbox.resolveExisting(path.resolve(root, input.targetPath));
    const stat = await fs.stat(target.resolvedPath);
    const uid = input.uid ?? stat.uid;
    const gid = input.gid ?? stat.gid;

    validateId("uid", uid);
    validateId("gid", gid);

    await fs.chown(target.resolvedPath, uid, gid);

    return {
      path: toRelativePath(root, target.resolvedPath),
      uid,
      gid,
    };
  }

  public async createZip(input: {
    root?: string;
    sourcePaths: readonly string[];
    targetPath: string;
    overwrite?: boolean;
  }): Promise<{ root: string; path: string; size: number }> {
    if (input.sourcePaths.length === 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "At least one source path is required",
        statusCode: 400,
      });
    }

    const root = this.resolveRoot(input.root);
    const targetPath = await this.resolveWritableFile(root, input.targetPath);

    if (!input.overwrite && (await pathExists(targetPath))) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Archive already exists",
        statusCode: 409,
      });
    }

    const zip = new AdmZip();

    for (const sourcePath of input.sourcePaths) {
      const source = await this.sandbox.resolveExisting(path.resolve(root, sourcePath));
      const sourceStat = await fs.stat(source.resolvedPath);
      const archiveName = toSafeArchiveName(toRelativePath(root, source.resolvedPath));

      if (sourceStat.isDirectory()) {
        zip.addLocalFolder(source.resolvedPath, archiveName);
      } else if (sourceStat.isFile()) {
        zip.addLocalFile(source.resolvedPath, path.posix.dirname(archiveName));
      } else {
        throw new AppError({
          code: "INVALID_PATH",
          message: "Only files and directories can be archived",
          statusCode: 400,
        });
      }
    }

    zip.writeZip(targetPath);
    const stat = await fs.stat(targetPath);

    if (stat.size > this.maxArchiveBytes) {
      await fs.rm(targetPath, { force: true });
      throw new AppError({
        code: "INVALID_PATH",
        message: "Archive is too large",
        statusCode: 413,
      });
    }

    return {
      root,
      path: toRelativePath(root, targetPath),
      size: stat.size,
    };
  }

  public async extractZip(input: {
    root?: string;
    archivePath: string;
    targetDirectory?: string;
    overwrite?: boolean;
  }): Promise<{ root: string; path: string; entries: number }> {
    const root = this.resolveRoot(input.root);
    const archive = await this.sandbox.resolveExisting(path.resolve(root, input.archivePath));
    const archiveStat = await fs.stat(archive.resolvedPath);

    if (!archiveStat.isFile()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Archive path is not a file",
        statusCode: 400,
      });
    }

    if (archiveStat.size > this.maxArchiveBytes) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Archive is too large",
        statusCode: 413,
      });
    }

    const targetDirectory = await this.sandbox.resolveExisting(path.resolve(root, input.targetDirectory ?? "."));
    const targetStat = await fs.stat(targetDirectory.resolvedPath);

    if (!targetStat.isDirectory()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Extract target is not a directory",
        statusCode: 400,
      });
    }

    const zip = new AdmZip(archive.resolvedPath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      const targetPath = resolveArchiveEntry(targetDirectory.resolvedPath, entry.entryName);
      this.sandbox.resolveFromRoot(root, path.relative(root, targetPath));

      if (!input.overwrite && (await pathExists(targetPath))) {
        throw new AppError({
          code: "INVALID_PATH",
          message: "Extract target already exists",
          statusCode: 409,
        });
      }
    }

    for (const entry of entries) {
      const targetPath = resolveArchiveEntry(targetDirectory.resolvedPath, entry.entryName);

      if (entry.isDirectory) {
        await fs.mkdir(targetPath, { recursive: true });
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.getData());
    }

    return {
      root,
      path: toRelativePath(root, targetDirectory.resolvedPath),
      entries: entries.length,
    };
  }

  private async resolveWritableFile(root: string, targetPath: string): Promise<string> {
    const absoluteTargetPath = path.resolve(root, targetPath);

    if (await pathExists(absoluteTargetPath)) {
      const existingTarget = await this.sandbox.resolveExisting(absoluteTargetPath);
      const existingStat = await fs.stat(existingTarget.resolvedPath);

      if (!existingStat.isFile()) {
        throw new AppError({
          code: "INVALID_PATH",
          message: "Path is not a file",
          statusCode: 400,
        });
      }

      return existingTarget.resolvedPath;
    }

    const safeTarget = this.sandbox.resolveFromRoot(root, path.relative(root, absoluteTargetPath));
    const parent = await this.sandbox.resolveExisting(path.dirname(safeTarget.resolvedPath));
    const parentStat = await fs.stat(parent.resolvedPath);

    if (!parentStat.isDirectory()) {
      throw new AppError({
        code: "INVALID_PATH",
        message: "Parent path is not a directory",
        statusCode: 400,
      });
    }

    return safeTarget.resolvedPath;
  }

  private resolveRoot(root: string | undefined): string {
    if (!root) {
      return this.roots[0]!;
    }

    const resolvedRoot = path.resolve(root);
    const matchedRoot = this.roots.find((allowedRoot) => isSamePath(allowedRoot, resolvedRoot));

    if (!matchedRoot) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Root is not allowed",
        statusCode: 403,
      });
    }

    return matchedRoot;
  }
}

function toRelativePath(root: string, targetPath: string): string {
  const relative = path.relative(root, targetPath);
  return relative ? relative.split(path.sep).join("/") : ".";
}

function getEntryType(dirent: import("node:fs").Dirent): FileEntry["type"] {
  if (dirent.isDirectory()) {
    return "directory";
  }

  if (dirent.isFile()) {
    return "file";
  }

  if (dirent.isSymbolicLink()) {
    return "symlink";
  }

  return "other";
}

function isSamePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName);

  if (!baseName || baseName === "." || baseName === ".." || baseName.includes("\0")) {
    throw new AppError({
      code: "INVALID_PATH",
      message: "Invalid file name",
      statusCode: 400,
    });
  }

  return baseName;
}

function validateId(name: "gid" | "uid", value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: `${name} must be a non-negative integer`,
      statusCode: 400,
    });
  }
}

function toSafeArchiveName(name: string): string {
  const normalized = name.split(path.sep).join("/").replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("../") || normalized.includes("/../") || path.isAbsolute(normalized)) {
    throw new AppError({
      code: "INVALID_PATH",
      message: "Invalid archive path",
      statusCode: 400,
    });
  }

  return normalized;
}

function resolveArchiveEntry(targetDirectory: string, entryName: string): string {
  const normalized = entryName.replaceAll("\\", "/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..") ||
    normalized.includes("\0")
  ) {
    throw new AppError({
      code: "INVALID_PATH",
      message: "Archive contains an unsafe entry path",
      statusCode: 400,
    });
  }

  return path.resolve(targetDirectory, normalized);
}
