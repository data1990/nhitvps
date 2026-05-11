import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PathSandbox } from "../src/security/index.js";

describe("PathSandbox", () => {
  let tempRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-root-"));
    outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-outside-"));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.rm(outsideRoot, { recursive: true, force: true });
  });

  it("allows paths inside an allowed root", () => {
    const sandbox = new PathSandbox([tempRoot]);
    const resolved = sandbox.resolveFromRoot(tempRoot, "site/index.html");

    expect(resolved.resolvedPath).toBe(path.resolve(tempRoot, "site/index.html").toLowerCase());
    expect(resolved.root).toBe(path.resolve(tempRoot).toLowerCase());
  });

  it("blocks traversal outside an allowed root", () => {
    const sandbox = new PathSandbox([tempRoot]);

    expect(() => sandbox.resolveFromRoot(tempRoot, "../outside.txt")).toThrowError("Path is outside allowed roots");
  });

  it("blocks absolute paths outside allowed roots", () => {
    const sandbox = new PathSandbox([tempRoot]);

    expect(() => sandbox.resolve(path.join(outsideRoot, "secret.txt"))).toThrowError("Path is outside allowed roots");
  });

  it("blocks symlink escape for existing paths when symlinks are available", async () => {
    const sandbox = new PathSandbox([tempRoot]);
    const outsideFile = path.join(outsideRoot, "secret.txt");
    const linkPath = path.join(tempRoot, "link-to-secret");
    await fs.writeFile(outsideFile, "secret");

    try {
      await fs.symlink(outsideFile, linkPath);
    } catch {
      return;
    }

    await expect(sandbox.resolveExisting(linkPath)).rejects.toMatchObject({
      code: "FORBIDDEN_PATH",
      statusCode: 403,
    });
  });
});

