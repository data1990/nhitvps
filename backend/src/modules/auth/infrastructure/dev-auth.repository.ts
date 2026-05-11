import { env } from "../../../config/env.js";
import type { PermissionKey, User } from "../domain/auth.types.js";
import { PasswordHasher } from "../application/password-hasher.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";

const DEV_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_ADMIN_PASSWORD_HASH =
  "scrypt$16384$8$1$eYUo6SzI6L_2HsmzcyHWtw$HUF79XUy5NNTvRTRkK7WPwmnqQpi5qULo1MAIjiRl2cvwQ9Dyop21Fl3Kgke1NrDTehN7SsnjJe3lout5gwJTg";

export const devAdminCredentials = Object.freeze({
  username: "admin",
  email: "admin@nhitvps.local",
  password: "P@ssw0rd12345",
});

export async function createDefaultAuthRepository(): Promise<InMemoryAuthRepository> {
  if (env.BOOTSTRAP_ADMIN_USERNAME || env.BOOTSTRAP_ADMIN_EMAIL || env.BOOTSTRAP_ADMIN_PASSWORD) {
    return await createBootstrapAdminRepository();
  }

  if (env.NODE_ENV === "production") {
    return new InMemoryAuthRepository();
  }

  const now = new Date("2026-05-10T00:00:00.000Z");
  const admin: User = {
    id: DEV_ADMIN_USER_ID,
    email: devAdminCredentials.email,
    username: devAdminCredentials.username,
    displayName: "NhiTVPS Admin",
    passwordHash: DEV_ADMIN_PASSWORD_HASH,
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

  const permissions: Record<string, readonly PermissionKey[]> = {
    [DEV_ADMIN_USER_ID]: ["system:manage"],
  };

  return new InMemoryAuthRepository([admin], permissions);
}

async function createBootstrapAdminRepository(): Promise<InMemoryAuthRepository> {
  if (!env.BOOTSTRAP_ADMIN_USERNAME || !env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together");
  }

  if (env.BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
  }

  const now = new Date();
  const admin: User = {
    id: DEV_ADMIN_USER_ID,
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    username: env.BOOTSTRAP_ADMIN_USERNAME,
    displayName: "NhiTVPS Admin",
    passwordHash: await new PasswordHasher().hash(env.BOOTSTRAP_ADMIN_PASSWORD),
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

  return new InMemoryAuthRepository([admin], {
    [DEV_ADMIN_USER_ID]: ["system:manage"],
  });
}
