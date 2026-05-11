import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import { NginxRuntimeService, type CommandExecutor } from "../src/modules/nginx/index.js";

describe("nginx runtime", () => {
  it("tests config before reload and restart", async () => {
    const executor = new FakeCommandExecutor();
    const service = new NginxRuntimeService(executor);

    await service.reload();
    await service.restart();

    expect(executor.calls.map((call) => call.policyId)).toEqual([
      "nginx:test",
      "nginx:reload",
      "nginx:test",
      "nginx:restart",
    ]);
  });

  it("exposes protected test/reload/restart endpoints", async () => {
    const user = await createUser();
    const executor = new FakeCommandExecutor();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:execute"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxCommandExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const testResponse = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/test",
      headers: { cookie },
    });
    const reloadResponse = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/reload",
      headers: { cookie },
    });
    const restartResponse = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/restart",
      headers: { cookie },
    });

    await app.close();

    expect(testResponse.statusCode).toBe(200);
    expect(reloadResponse.statusCode).toBe(200);
    expect(restartResponse.statusCode).toBe(200);
    expect(executor.calls.map((call) => call.policyId)).toEqual([
      "nginx:test",
      "nginx:test",
      "nginx:reload",
      "nginx:test",
      "nginx:restart",
    ]);
  });

  it("requires nginx execute permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxCommandExecutor: new FakeCommandExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/reload",
      headers: { cookie },
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

class FakeCommandExecutor implements CommandExecutor {
  public readonly calls: CommandRequest[] = [];

  public async run(request: CommandRequest): Promise<CommandResult> {
    this.calls.push(request);

    return {
      policyId: request.policyId,
      binary: request.policyId,
      args: request.args ?? [],
      exitCode: 0,
      signal: null,
      stdout: "ok",
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
    id: "00000000-0000-4000-8000-000000000005",
    email: "nginx-runtime@example.com",
    username: "nginx-runtime",
    displayName: "Nginx Runtime",
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
      identifier: "nginx-runtime",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}

