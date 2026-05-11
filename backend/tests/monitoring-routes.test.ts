import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";

describe("monitoring routes", () => {
  let tempRoot: string;
  let procRoot: string;
  let diskRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-monitoring-routes-"));
    procRoot = path.join(tempRoot, "proc");
    diskRoot = path.join(tempRoot, "disk");
    await fs.mkdir(path.join(procRoot, "net"), { recursive: true });
    await fs.mkdir(diskRoot, { recursive: true });
    await fs.writeFile(path.join(procRoot, "net", "dev"), "head\nhead\n", "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("returns system metrics for users with monitoring:read", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["monitoring:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      metricsOptions: {
        diskPaths: [diskRoot],
        procRoot,
        dockerSocketPath: path.join(tempRoot, "docker.sock"),
      },
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/monitoring/system",
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      memory: {
        totalBytes: expect.any(Number),
      },
      docker: {
        available: false,
      },
    });
  });

  it("requires monitoring read permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["monitoring:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      metricsOptions: {
        diskPaths: [diskRoot],
        procRoot,
      },
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/monitoring/system",
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
});

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000008",
    email: "monitoring-admin@example.com",
    username: "monitoring-admin",
    displayName: "Monitoring Admin",
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
      identifier: "monitoring-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
