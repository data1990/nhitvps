import { randomUUID } from "node:crypto";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { Session, User } from "../domain/auth.types.js";
import type { AuthRepository } from "./auth.repository.js";
import { PasswordHasher } from "./password-hasher.js";
import { SessionTokenService } from "./session-token-service.js";

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  status: User["status"];
  twoFactorEnabled: boolean;
};

export type LoginInput = {
  identifier: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
};

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export class AuthService {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher = new PasswordHasher(),
    private readonly sessionTokenService = new SessionTokenService(),
  ) {}

  public async login(input: LoginInput): Promise<{ user: PublicUser; session: Session; token: string }> {
    const identifier = normalizeIdentifier(input.identifier);
    const user = await this.repository.findUserByIdentifier(identifier);

    if (!user || !isUserAllowedToLogin(user)) {
      throwInvalidCredentials();
    }

    const passwordMatches = await this.passwordHasher.verify(input.password, user.passwordHash);

    if (!passwordMatches) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil =
        failedLoginCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await this.repository.incrementFailedLogin(user.id, lockedUntil);
      throwInvalidCredentials();
    }

    const now = new Date();
    await this.repository.resetLoginState(user.id, now);
    const token = this.sessionTokenService.createToken();
    const session = await this.repository.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: token.tokenHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: new Date(now.getTime() + env.SESSION_TTL_MINUTES * 60 * 1000),
    });

    return {
      user: toPublicUser(user),
      session,
      token: token.token,
    };
  }

  public async authenticate(token: string | undefined): Promise<{ user: PublicUser; session: Session }> {
    if (!token) {
      throwAuthRequired();
    }

    const tokenHash = this.sessionTokenService.hashToken(token);
    const session = await this.repository.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throwAuthRequired();
    }

    const user = await this.repository.findUserById(session.userId);

    if (!user || !isUserAllowedToUseSession(user)) {
      throwAuthRequired();
    }

    await this.repository.touchSession(session.id, new Date());

    return {
      user: toPublicUser(user),
      session,
    };
  }

  public async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = this.sessionTokenService.hashToken(token);
    const session = await this.repository.findSessionByTokenHash(tokenHash);

    if (session && !session.revokedAt) {
      await this.repository.revokeSession(session.id, new Date());
    }
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function isUserAllowedToLogin(user: User): boolean {
  return user.status === "active" && !user.deletedAt && (!user.lockedUntil || user.lockedUntil <= new Date());
}

function isUserAllowedToUseSession(user: User): boolean {
  return user.status === "active" && !user.deletedAt;
}

function throwInvalidCredentials(): never {
  throw new AppError({
    code: "AUTH_INVALID_CREDENTIALS",
    message: "Invalid credentials",
    statusCode: 401,
  });
}

function throwAuthRequired(): never {
  throw new AppError({
    code: "AUTH_REQUIRED",
    message: "Authentication is required",
    statusCode: 401,
  });
}

