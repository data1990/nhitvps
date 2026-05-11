import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "../shared/errors/app-error.js";

export type SandboxPath = {
  requestedPath: string;
  resolvedPath: string;
  root: string;
};

export class PathSandbox {
  private readonly roots: readonly string[];

  public constructor(allowedRoots: readonly string[]) {
    const roots = allowedRoots.map((root) => normalizePath(path.resolve(root)));

    if (roots.length === 0) {
      throw new AppError({
        code: "CONFIG_ERROR",
        message: "Path sandbox requires at least one allowed root",
        statusCode: 500,
      });
    }

    this.roots = roots;
  }

  public resolve(requestedPath: string): SandboxPath {
    validateRequestedPath(requestedPath);

    const candidate = normalizePath(path.resolve(requestedPath));
    const root = this.findContainingRoot(candidate);

    if (!root) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Path is outside allowed roots",
        statusCode: 403,
      });
    }

    return {
      requestedPath,
      resolvedPath: candidate,
      root,
    };
  }

  public resolveFromRoot(root: string, requestedPath: string): SandboxPath {
    validateRequestedPath(requestedPath);

    const resolvedRoot = normalizePath(path.resolve(root));

    if (!this.findContainingRoot(resolvedRoot)) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Root is outside allowed roots",
        statusCode: 403,
      });
    }

    const candidate = normalizePath(path.resolve(resolvedRoot, requestedPath));
    const containingRoot = this.findContainingRoot(candidate);

    if (!containingRoot) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Path is outside allowed roots",
        statusCode: 403,
      });
    }

    return {
      requestedPath,
      resolvedPath: candidate,
      root: containingRoot,
    };
  }

  public async resolveExisting(requestedPath: string): Promise<SandboxPath> {
    const candidate = this.resolve(requestedPath);
    const realCandidate = normalizePath(await fs.realpath(candidate.resolvedPath));
    const realRoots = await this.realAllowedRoots();
    const root = findContainingRoot(realCandidate, realRoots);

    if (!root) {
      throw new AppError({
        code: "FORBIDDEN_PATH",
        message: "Path resolves outside allowed roots",
        statusCode: 403,
      });
    }

    return {
      requestedPath,
      resolvedPath: realCandidate,
      root,
    };
  }

  private findContainingRoot(candidate: string): string | null {
    return findContainingRoot(candidate, this.roots);
  }

  private async realAllowedRoots(): Promise<readonly string[]> {
    const roots: string[] = [];

    for (const root of this.roots) {
      roots.push(normalizePath(await fs.realpath(root)));
    }

    return roots;
  }
}

function validateRequestedPath(requestedPath: string): void {
  if (!requestedPath.trim()) {
    throw new AppError({
      code: "INVALID_PATH",
      message: "Path cannot be empty",
      statusCode: 400,
    });
  }

  if (requestedPath.includes("\0")) {
    throw new AppError({
      code: "INVALID_PATH",
      message: "Path contains a null byte",
      statusCode: 400,
    });
  }
}

function normalizePath(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function findContainingRoot(candidate: string, roots: readonly string[]): string | null {
  return roots.find((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`)) ?? null;
}

