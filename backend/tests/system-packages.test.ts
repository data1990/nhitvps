import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import type { SystemPackageCommandExecutor } from "../src/modules/system/index.js";

describe("system package routes", () => {
  it("installs nginx through allowlisted package commands", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["system:manage"],
    });
    const executor = new RecordingExecutor();
    const app = await buildApp({
      authRepository: repository,
      systemPackageCommandExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/system/packages/install",
      headers: { cookie },
      payload: {
        component: "nginx",
        startService: true,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      component: "nginx",
      packages: ["nginx"],
      update: { policyId: "apt:update", args: ["update"] },
      install: { policyId: "apt:install", args: ["install", "-y", "nginx"] },
      service: { policyId: "systemctl:service", args: ["enable", "--now", "nginx"] },
    });
    expect(executor.requests).toEqual([
      { policyId: "apt:update", args: ["update"] },
      { policyId: "apt:install", args: ["install", "-y", "nginx"] },
      { policyId: "systemctl:service", args: ["enable", "--now", "nginx"] },
    ]);
  });

  it("reads package status for a selected component", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["system:manage"],
    });
    const app = await buildApp({
      authRepository: repository,
      systemPackageCommandExecutor: new RecordingExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/system/packages/status?component=nginx",
      headers: { cookie },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      components: [
        {
          component: "nginx",
          packages: [{ name: "nginx", installed: true }],
        },
      ],
    });
  });

  it("requires system manage permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      systemPackageCommandExecutor: new RecordingExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/system/packages/install",
      headers: { cookie },
      payload: {
        component: "nginx",
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

  it("installs a component stack in order", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["system:manage"],
    });
    const executor = new RecordingExecutor();
    const app = await buildApp({
      authRepository: repository,
      systemPackageCommandExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/system/packages/install-stack",
      headers: { cookie },
      payload: {
        components: ["nginx", "ufw"],
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [{ component: "nginx" }, { component: "ufw" }],
    });
    expect(executor.requests.map((request) => request.policyId)).toEqual([
      "apt:update",
      "apt:install",
      "systemctl:service",
      "apt:update",
      "apt:install",
      "systemctl:service",
    ]);
  });
});

class RecordingExecutor implements SystemPackageCommandExecutor {
  public readonly requests: CommandRequest[] = [];

  public async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push({
      policyId: request.policyId,
      args: [...(request.args ?? [])],
    });

    return {
      policyId: request.policyId,
      binary: request.policyId.split(":")[0] ?? request.policyId,
      args: request.args ?? [],
      exitCode: 0,
      signal: null,
      stdout: `${request.policyId} ok`,
      stderr: "",
      durationMs: 1,
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
}

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000009",
    email: "system-admin@example.com",
    username: "system-admin",
    displayName: "System Admin",
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
      identifier: "system-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
