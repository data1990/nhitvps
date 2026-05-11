import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  AuthService,
  AuthorizationService,
  createPermissionGuard,
  hasGrantedPermission,
  InMemoryAuthRepository,
  PasswordHasher,
} from "../src/modules/auth/index.js";
import type { User } from "../src/modules/auth/domain/auth.types.js";

describe("RBAC", () => {
  it("evaluates exact, module manage, and system manage permissions", () => {
    expect(hasGrantedPermission(["nginx:read"], "nginx:read")).toBe(true);
    expect(hasGrantedPermission(["nginx:manage"], "nginx:create")).toBe(true);
    expect(hasGrantedPermission(["system:manage"], "database:delete")).toBe(true);
    expect(hasGrantedPermission(["file:read"], "file:update")).toBe(false);
  });

  it("allows guarded routes with a matching permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["nginx:manage"],
    });
    const app = await buildApp({ authRepository: repository });
    const authService = new AuthService(repository);
    const authorizationService = new AuthorizationService(repository);

    app.get(
      "/api/v1/protected/nginx",
      {
        preHandler: createPermissionGuard({
          authService,
          authorizationService,
          permission: "nginx:create",
        }),
      },
      async () => ({
        status: "allowed",
      }),
    );

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "admin",
        password: "P@ssw0rd12345",
      },
    });
    const cookie = extractCookie(loginResponse.headers["set-cookie"]).split(";")[0] ?? "";

    const protectedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/protected/nginx",
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(protectedResponse.statusCode).toBe(200);
    expect(protectedResponse.json()).toEqual({
      status: "allowed",
    });
  });

  it("denies guarded routes without permission", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["file:read"],
    });
    const app = await buildApp({ authRepository: repository });
    const authService = new AuthService(repository);
    const authorizationService = new AuthorizationService(repository);

    app.get(
      "/api/v1/protected/firewall",
      {
        preHandler: createPermissionGuard({
          authService,
          authorizationService,
          permission: "firewall:update",
        }),
      },
      async () => ({
        status: "allowed",
      }),
    );

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "admin",
        password: "P@ssw0rd12345",
      },
    });
    const cookie = extractCookie(loginResponse.headers["set-cookie"]).split(";")[0] ?? "";

    const protectedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/protected/firewall",
      headers: {
        cookie,
      },
    });

    await app.close();

    expect(protectedResponse.statusCode).toBe(403);
    expect(protectedResponse.json()).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("requires authentication for guarded routes", async () => {
    const user = await createUser();
    const repository = new InMemoryAuthRepository([user], {
      [user.id]: ["system:manage"],
    });
    const app = await buildApp({ authRepository: repository });
    const authService = new AuthService(repository);
    const authorizationService = new AuthorizationService(repository);

    app.get(
      "/api/v1/protected/system",
      {
        preHandler: createPermissionGuard({
          authService,
          authorizationService,
          permission: "system:read",
        }),
      },
      async () => ({
        status: "allowed",
      }),
    );

    const protectedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/protected/system",
    });

    await app.close();

    expect(protectedResponse.statusCode).toBe(401);
    expect(protectedResponse.json()).toMatchObject({
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });
});

async function createUser(): Promise<User> {
  const now = new Date("2026-05-10T00:00:00.000Z");
  const hasher = new PasswordHasher();

  return {
    id: "00000000-0000-4000-8000-000000000002",
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
  };
}

function extractCookie(setCookie: string | string[] | undefined): string {
  if (Array.isArray(setCookie)) {
    return setCookie[0] ?? "";
  }

  return setCookie ?? "";
}

