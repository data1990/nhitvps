import type { Session, User } from "../domain/auth.types.js";
import type { PermissionKey } from "../domain/auth.types.js";

export type CreateSessionInput = {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
};

export interface AuthRepository {
  findUserByIdentifier(identifier: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  incrementFailedLogin(userId: string, lockedUntil: Date | null): Promise<void>;
  resetLoginState(userId: string, loggedInAt: Date): Promise<void>;
  createSession(input: CreateSessionInput): Promise<Session>;
  findSessionByTokenHash(tokenHash: string): Promise<Session | null>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  touchSession(sessionId: string, seenAt: Date): Promise<void>;
  listPermissionKeysByUserId(userId: string): Promise<PermissionKey[]>;
}
