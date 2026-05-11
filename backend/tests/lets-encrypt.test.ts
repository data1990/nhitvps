import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import { createCertbotArgs, LetsEncryptService, type CommandExecutor } from "../src/modules/nginx/index.js";

describe("Let's Encrypt service", () => {
  it("builds certbot arguments safely", () => {
    expect(
      createCertbotArgs({
        domain: "example.com",
        aliases: ["www.example.com"],
        email: "admin@example.com",
        redirect: true,
        staging: true,
      }),
    ).toEqual([
      "--nginx",
      "--non-interactive",
      "--agree-tos",
      "--email",
      "admin@example.com",
      "--staging",
      "--redirect",
      "-d",
      "example.com",
      "-d",
      "www.example.com",
    ]);
  });

  it("runs certbot then reloads nginx", async () => {
    const executor = new FakeCommandExecutor();
    const service = new LetsEncryptService(executor);

    await service.issueCertificate({
      domain: "example.com",
      aliases: ["www.example.com"],
      email: "admin@example.com",
      redirect: true,
    });

    expect(executor.calls.map((call) => call.policyId)).toEqual(["certbot:nginx", "nginx:test", "nginx:reload"]);
  });

  it("rejects invalid email and wildcard domains", async () => {
    const service = new LetsEncryptService(new FakeCommandExecutor());

    await expect(
      service.issueCertificate({
        domain: "example.com",
        email: "bad-email",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      service.issueCertificate({
        domain: "*.example.com",
        email: "admin@example.com",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("exposes protected Let's Encrypt endpoint", async () => {
    const user = await createUser();
    const executor = new FakeCommandExecutor();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:update"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxCommandExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/ssl/lets-encrypt",
      headers: { cookie },
      payload: {
        domain: "example.com",
        aliases: ["www.example.com"],
        email: "admin@example.com",
        redirect: true,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(executor.calls.map((call) => call.policyId)).toEqual(["certbot:nginx", "nginx:test", "nginx:reload"]);
  });

  it("requires nginx update permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      nginxCommandExecutor: new FakeCommandExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/nginx/ssl/lets-encrypt",
      headers: { cookie },
      payload: {
        domain: "example.com",
        email: "admin@example.com",
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
    id: "00000000-0000-4000-8000-000000000006",
    email: "ssl-admin@example.com",
    username: "ssl-admin",
    displayName: "SSL Admin",
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
      identifier: "ssl-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}

