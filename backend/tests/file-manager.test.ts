import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";

describe("file manager API", () => {
  let tempRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-files-"));
    outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-outside-"));
    await fs.mkdir(path.join(tempRoot, "site"));
    await fs.writeFile(path.join(tempRoot, "site", "index.txt"), "hello file manager");
    await fs.writeFile(path.join(outsideRoot, "secret.txt"), "outside");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.rm(outsideRoot, { recursive: true, force: true });
  });

  it("lists and reads files for users with file:read", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/files/list?root=${encodeURIComponent(tempRoot)}&path=site`,
      headers: {
        cookie,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      path: "site",
      entries: [
        {
          name: "index.txt",
          type: "file",
          path: "site/index.txt",
        },
      ],
    });

    const readResponse = await app.inject({
      method: "GET",
      url: `/api/v1/files/read?root=${encodeURIComponent(tempRoot)}&path=site/index.txt`,
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      path: "site/index.txt",
      content: "hello file manager",
    });
  });

  it("blocks traversal outside allowed roots", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/files/read?root=${encodeURIComponent(tempRoot)}&path=../${path.basename(outsideRoot)}/secret.txt`,
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "FORBIDDEN_PATH",
      },
    });
  });

  it("requires authentication", async () => {
    const app = await buildApp({
      fileManagerRoots: [tempRoot],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/files/list?root=${encodeURIComponent(tempRoot)}`,
    });

    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("requires file read permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/files/list?root=${encodeURIComponent(tempRoot)}`,
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("uploads and downloads files for users with file:update and file:read", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:read", "file:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/upload",
      headers: {
        cookie,
        "content-type": "multipart/form-data; boundary=nhitvps-boundary",
      },
      payload: createMultipartPayload({
        root: tempRoot,
        path: "site",
        fileName: "upload.txt",
        content: "uploaded content",
      }),
    });

    expect(uploadResponse.statusCode).toBe(200);
    expect(uploadResponse.json()).toMatchObject({
      path: "site/upload.txt",
      size: 16,
    });

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/files/download?root=${encodeURIComponent(tempRoot)}&path=site/upload.txt`,
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-disposition"]).toContain("upload.txt");
    expect(downloadResponse.body).toBe("uploaded content");
  });

  it("writes text files and changes mode", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const writeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/write",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        path: "site/edit.txt",
        content: "edited text",
      },
    });

    expect(writeResponse.statusCode).toBe(200);
    expect(await fs.readFile(path.join(tempRoot, "site", "edit.txt"), "utf8")).toBe("edited text");

    const chmodResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/chmod",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        path: "site/edit.txt",
        mode: "0644",
      },
    });

    await app.close();

    expect(chmodResponse.statusCode).toBe(200);
    expect(chmodResponse.json()).toMatchObject({
      path: "site/edit.txt",
      mode: "0644",
    });
  });

  it("validates chmod and chown input", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const chmodResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/chmod",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        path: "site/index.txt",
        mode: "9999",
      },
    });

    const chownResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/chown",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        path: "site/index.txt",
      },
    });

    await app.close();

    expect(chmodResponse.statusCode).toBe(400);
    expect(chownResponse.statusCode).toBe(400);
  });

  it("creates and extracts zip archives", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const zipResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/zip",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        sourcePaths: ["site/index.txt"],
        targetPath: "site.zip",
      },
    });

    expect(zipResponse.statusCode).toBe(200);
    expect(await fileExists(path.join(tempRoot, "site.zip"))).toBe(true);

    await fs.mkdir(path.join(tempRoot, "extract"));
    const unzipResponse = await app.inject({
      method: "POST",
      url: "/api/v1/files/unzip",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        archivePath: "site.zip",
        targetDirectory: "extract",
      },
    });

    await app.close();

    expect(unzipResponse.statusCode).toBe(200);
    expect(await fs.readFile(path.join(tempRoot, "extract", "site", "index.txt"), "utf8")).toBe(
      "hello file manager",
    );
  });

  it("blocks zip slip entries during unzip", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:update"],
    });
    await fs.writeFile(path.join(tempRoot, "evil.zip"), createStoredZip("../escape.txt", "escape"));

    const app = await buildApp({
      authRepository: repository,
      fileManagerRoots: [tempRoot],
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/files/unzip",
      headers: {
        cookie,
      },
      payload: {
        root: tempRoot,
        archivePath: "evil.zip",
        targetDirectory: ".",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(await fileExists(path.join(tempRoot, "escape.txt"))).toBe(false);
  });
});

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000003",
    email: "file-admin@example.com",
    username: "file-admin",
    displayName: "File Admin",
    passwordHash: await hasher.hash("P@ssw0rd12345"),
    status: "active",
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

async function loginAndGetCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      identifier: "file-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}

function createMultipartPayload(input: {
  root: string;
  path: string;
  fileName: string;
  content: string;
}): string {
  const boundary = "nhitvps-boundary";
  return [
    `--${boundary}`,
    'Content-Disposition: form-data; name="root"',
    "",
    input.root,
    `--${boundary}`,
    'Content-Disposition: form-data; name="path"',
    "",
    input.path,
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${input.fileName}"`,
    "Content-Type: text/plain",
    "",
    input.content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createStoredZip(fileName: string, content: string): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const data = Buffer.from(content, "utf8");
  const crc = crc32(data);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(0, 10);
  centralDirectory.writeUInt16LE(0, 12);
  centralDirectory.writeUInt16LE(0, 14);
  centralDirectory.writeUInt32LE(crc, 16);
  centralDirectory.writeUInt32LE(data.length, 20);
  centralDirectory.writeUInt32LE(data.length, 24);
  centralDirectory.writeUInt16LE(name.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);

  const centralDirectorySize = centralDirectory.length + name.length;
  const centralDirectoryOffset = localHeader.length + name.length + data.length;
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralDirectorySize, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, name, data, centralDirectory, name, endRecord]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
