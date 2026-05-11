import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import type { DatabaseBackupCommandExecutor } from "../src/modules/database/index.js";

describe("database backup routes", () => {
  let tempRoot: string;
  let backupDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nhitvps-db-backup-routes-"));
    backupDir = path.join(tempRoot, "backups");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("backs up database for users with backup:create", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["backup:create"],
    });
    const executor = new RecordingBackupExecutor("CREATE DATABASE `tenant_db`;\n");
    const app = await buildApp({
      authRepository: repository,
      databaseBackupCommandExecutor: executor,
      databaseBackupOptions: {
        backupDir,
        mysqlHost: "127.0.0.1",
        mysqlPort: 3306,
        mysqlUser: "root",
        mysqlPassword: "super-secret",
      },
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/databases/backups",
      headers: {
        cookie,
      },
      payload: {
        databaseName: "tenant_db",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      databaseName: "tenant_db",
    });
    expect(response.body).not.toContain("super-secret");
    expect(executor.requests).toHaveLength(1);
  });

  it("requires restore permission for restore route", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["backup:create"],
    });
    const app = await buildApp({
      authRepository: repository,
      databaseBackupCommandExecutor: new RecordingBackupExecutor(""),
      databaseBackupOptions: {
        backupDir,
      },
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/databases/restore",
      headers: {
        cookie,
      },
      payload: {
        backupPath: path.join(backupDir, "missing.sql"),
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

class RecordingBackupExecutor implements DatabaseBackupCommandExecutor {
  readonly requests: CommandRequest[] = [];

  constructor(private readonly stdout: string) {}

  async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(request);

    return {
      policyId: request.policyId,
      binary: request.policyId,
      args: request.args ?? [],
      exitCode: 0,
      signal: null,
      stdout: this.stdout,
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
    email: "backup-admin@example.com",
    username: "backup-admin",
    displayName: "Backup Admin",
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
      identifier: "backup-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
