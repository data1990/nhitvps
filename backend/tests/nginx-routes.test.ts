import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";

describe("nginx routes", () => {
  let tempRoot: string;
  let sitesAvailableDir: string;
  let sitesEnabledDir: string;
  let backupDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-nginx-"));
    sitesAvailableDir = path.join(tempRoot, "available");
    sitesEnabledDir = path.join(tempRoot, "enabled");
    backupDir = path.join(tempRoot, "backups");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("creates and backs up vhost configs for users with nginx:update", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxConfigPaths: {
        sitesAvailableDir,
        sitesEnabledDir,
        backupDir,
      },
    });
    const cookie = await loginAndGetCookie(app);

    const payload = createSitePayload({
      documentRoot: path.join(tempRoot, "www", "public"),
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/sites",
      headers: {
        cookie,
      },
      payload,
    });

    expect(createResponse.statusCode).toBe(200);
    expect(await fs.readFile(path.join(sitesAvailableDir, "example.com.conf"), "utf8")).toContain(
      "server_name example.com www.example.com;",
    );
    expect(await fs.readFile(path.join(sitesEnabledDir, "example.com.conf"), "utf8")).toContain(
      "root",
    );

    const overwriteResponse = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/sites",
      headers: {
        cookie,
      },
      payload,
    });

    await app.close();

    expect(overwriteResponse.statusCode).toBe(200);
    expect(overwriteResponse.json().backupPath).toBeTypeOf("string");
    expect((await fs.readdir(backupDir)).length).toBe(1);
  });

  it("requires nginx update permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxConfigPaths: {
        sitesAvailableDir,
        sitesEnabledDir,
        backupDir,
      },
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/sites",
      headers: {
        cookie,
      },
      payload: createSitePayload({
        documentRoot: path.join(tempRoot, "www", "public"),
      }),
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });
});

function createSitePayload(input: { documentRoot: string }) {
  return {
    id: "site-1",
    domain: "example.com",
    aliases: ["www.example.com"],
    mode: "static",
    documentRoot: input.documentRoot,
    sslMode: "none",
    accessLogPath: path.join(input.documentRoot, "..", "logs", "access.log"),
    errorLogPath: path.join(input.documentRoot, "..", "logs", "error.log"),
    enabled: true,
  };
}

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000004",
    email: "nginx-admin@example.com",
    username: "nginx-admin",
    displayName: "Nginx Admin",
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
      identifier: "nginx-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}

