import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";
import type { DatabaseSqlExecutor, SqlParameter } from "../src/modules/database/index.js";

describe("database routes", () => {
  it("provisions database resources for users with database:create", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["database:create"],
    });
    const executor = new RecordingDatabaseExecutor();
    const app = await buildApp({
      authRepository: repository,
      databaseSqlExecutor: executor,
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/databases/provision",
      headers: {
        cookie,
      },
      payload: {
        name: "tenant_db",
        username: "tenant_user",
        host: "localhost",
        password: "Str0ngDatabasePass!",
        privileges: ["SELECT", "INSERT"],
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      database: {
        name: "tenant_db",
      },
      user: {
        username: "tenant_user",
      },
      privileges: ["SELECT", "INSERT"],
    });
    expect(response.body).not.toContain("Str0ngDatabasePass!");
    expect(executor.calls).toHaveLength(3);
  });

  it("requires database create permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["database:read"],
    });
    const app = await buildApp({
      authRepository: repository,
      databaseSqlExecutor: new RecordingDatabaseExecutor(),
    });
    const cookie = await loginAndGetCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/databases/provision",
      headers: {
        cookie,
      },
      payload: {
        name: "tenant_db",
        username: "tenant_user",
        password: "Str0ngDatabasePass!",
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

class RecordingDatabaseExecutor implements DatabaseSqlExecutor {
  readonly calls: Array<{ sql: string; params: SqlParameter[] }> = [];

  async execute(sql: string, params: SqlParameter[] = []): Promise<unknown> {
    this.calls.push({ sql, params });
    return {};
  }
}

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000005",
    email: "database-admin@example.com",
    username: "database-admin",
    displayName: "Database Admin",
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
      identifier: "database-admin",
      password: "P@ssw0rd12345",
    },
  });
  const setCookie = loginResponse.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return cookie?.split(";")[0] ?? "";
}
