import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import { clampMetricsIntervalMs } from "../src/modules/monitoring/http/monitoring.routes.js";

describe("monitoring websocket stream", () => {
  let tempRoot: string;
  let procRoot: string;
  let diskRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-monitoring-stream-"));
    procRoot = path.join(tempRoot, "proc");
    diskRoot = path.join(tempRoot, "disk");
    await fs.mkdir(path.join(procRoot, "net"), { recursive: true });
    await fs.mkdir(diskRoot, { recursive: true });
    await fs.writeFile(path.join(procRoot, "net", "dev"), "head\nhead\n", "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("streams system metrics to users with monitoring:read", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["monitoring:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      metricsOptions: {
        diskPaths: [diskRoot],
        procRoot,
      },
    });
    const cookie = await loginAndGetCookie(app);
    await app.ready();

    const socket = await app.injectWS("/api/v1/monitoring/system/stream?intervalMs=1000", {
      headers: {
        cookie,
      },
    });
    const message = await nextMessage(socket);
    socket.terminate();
    await app.close();

    expect(message).toMatchObject({
      type: "system_metrics",
      data: {
        memory: {
          totalBytes: expect.any(Number),
        },
      },
    });
  });

  it("rejects websocket upgrade without monitoring read permission", async () => {
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
    await app.ready();

    await expect(
      app.injectWS("/api/v1/monitoring/system/stream", {
        headers: {
          cookie,
        },
      }),
    ).rejects.toThrowError("Unexpected server response: 403");

    await app.close();
  });

  it("clamps stream interval to a safe range", () => {
    expect(clampMetricsIntervalMs("10")).toBe(1000);
    expect(clampMetricsIntervalMs("120000")).toBe(60000);
    expect(clampMetricsIntervalMs("abc")).toBe(5000);
  });
});

function nextMessage(socket: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["injectWS"]>>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for websocket message"));
    }, 5_000);

    socket.once("message", (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
}

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000009",
    email: "monitoring-stream@example.com",
    username: "monitoring-stream",
    displayName: "Monitoring Stream",
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
      identifier: "monitoring-stream",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
