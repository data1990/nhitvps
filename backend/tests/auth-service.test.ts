import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { InMemoryAuthRepository, PasswordHasher } from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";

describe("auth API", () => {
  it("hashes and verifies passwords", async () => {
    const hasher = new PasswordHasher();
    const hash = await hasher.hash("correct horse battery staple");

    expect(hash).toMatch(/^scrypt\$/);
    expect(await hasher.verify("correct horse battery staple", hash)).toBe(true);
    expect(await hasher.verify("wrong password", hash)).toBe(false);
  });

  it("logs in, reads current user, and logs out", async () => {
    const repository = new InMemoryAuthRepository([await createUser()]);
    const app = await buildApp({ authRepository: repository });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "admin@example.com",
        password: "P@ssw0rd12345",
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      user: {
        email: "admin@example.com",
        username: "admin",
      },
    });
    expect(JSON.stringify(loginResponse.json())).not.toContain("passwordHash");

    const cookie = extractCookie(loginResponse.headers["set-cookie"]);
    expect(cookie).toContain(`${env.SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: cookie.split(";")[0] ?? "",
      },
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      user: {
        username: "admin",
      },
    });

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: cookie.split(";")[0] ?? "",
      },
    });

    expect(logoutResponse.statusCode).toBe(200);

    const afterLogoutResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: cookie.split(";")[0] ?? "",
      },
    });

    await app.close();

    expect(afterLogoutResponse.statusCode).toBe(401);
    expect(afterLogoutResponse.json()).toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("rejects invalid credentials", async () => {
    const repository = new InMemoryAuthRepository([await createUser()]);
    const app = await buildApp({ authRepository: repository });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "admin@example.com",
        password: "wrong-password",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials",
      },
    });
  });

  it("rejects disabled users", async () => {
    const disabledUser = await createUser({
      status: "disabled",
    });
    const repository = new InMemoryAuthRepository([disabledUser]);
    const app = await buildApp({ authRepository: repository });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "admin@example.com",
        password: "P@ssw0rd12345",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
      },
    });
  });
});

async function createUser(overrides: Partial<User> = {}): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    username: "admin",
    displayName: "Admin",
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
    ...overrides,
  };
}

function extractCookie(setCookie: string | string[] | undefined): string {
  if (Array.isArray(setCookie)) {
    return setCookie[0] ?? "";
  }

  return setCookie ?? "";
}

