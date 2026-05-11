import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import type { FirewallCommandExecutor } from "../src/modules/firewall/index.js";

describe("firewall routes", () => {
  it("applies firewall rules for users with firewall:update", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["firewall:update"],
    });
    const executor = new RecordingFirewallExecutor();
    const app = await buildApp({
      authRepository: repository,
      firewallCommandExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/firewall/rules/apply",
      headers: {
        cookie,
      },
      payload: createRulePayload(),
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      applied: [
        {
          policyId: "ufw:apply",
        },
      ],
      rolledBack: [],
    });
    expect(executor.requests[0]?.args).toEqual([
      "deny",
      "in",
      "from",
      "198.51.100.10",
      "to",
      "any",
      "port",
      "22",
      "proto",
      "tcp",
    ]);
  });

  it("requires firewall update permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["firewall:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      firewallCommandExecutor: new RecordingFirewallExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/firewall/rules/apply",
      headers: {
        cookie,
      },
      payload: createRulePayload(),
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

class RecordingFirewallExecutor implements FirewallCommandExecutor {
  readonly requests: CommandRequest[] = [];

  async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(request);

    return {
      policyId: request.policyId,
      binary: "ufw",
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

function createRulePayload() {
  return {
    id: "fw-route-1",
    name: "Block SSH attacker",
    type: "blacklist",
    action: "deny",
    direction: "inbound",
    protocol: "tcp",
    targets: [{ kind: "ip", value: "198.51.100.10" }],
    ports: [22],
    priority: 100,
    status: "enabled",
  };
}

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000007",
    email: "firewall-admin@example.com",
    username: "firewall-admin",
    displayName: "Firewall Admin",
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
      identifier: "firewall-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
