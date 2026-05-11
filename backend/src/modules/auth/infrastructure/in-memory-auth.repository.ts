import type { Session, User } from "../domain/auth.types.js";
import type { PermissionKey } from "../domain/auth.types.js";
import type { AuthRepository, CreateSessionInput } from "../application/auth.repository.js";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, Session>();
  private readonly permissionKeysByUserId = new Map<string, PermissionKey[]>();

  public constructor(
    seedUsers: readonly User[] = [],
    seedPermissions: ReadonlyMap<string, readonly PermissionKey[]> | Record<string, readonly PermissionKey[]> = {},
  ) {
    for (const user of seedUsers) {
      this.users.set(user.id, cloneUser(user));
    }

    if (seedPermissions instanceof Map) {
      for (const [userId, permissions] of seedPermissions.entries()) {
        this.permissionKeysByUserId.set(userId, [...permissions]);
      }
    } else {
      for (const [userId, permissions] of Object.entries(seedPermissions)) {
        this.permissionKeysByUserId.set(userId, [...permissions]);
      }
    }
  }

  public async findUserByIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.trim().toLowerCase();

    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized || user.username.toLowerCase() === normalized) {
        return cloneUser(user);
      }
    }

    return null;
  }

  public async findUserById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? cloneUser(user) : null;
  }

  public async incrementFailedLogin(userId: string, lockedUntil: Date | null): Promise<void> {
    const user = this.users.get(userId);

    if (!user) {
      return;
    }

    user.failedLoginCount += 1;
    user.lockedUntil = lockedUntil;
    user.status = lockedUntil ? "locked" : user.status;
    user.updatedAt = new Date();
  }

  public async resetLoginState(userId: string, loggedInAt: Date): Promise<void> {
    const user = this.users.get(userId);

    if (!user) {
      return;
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = loggedInAt;
    user.status = user.status === "locked" ? "active" : user.status;
    user.updatedAt = loggedInAt;
  }

  public async createSession(input: CreateSessionInput): Promise<Session> {
    const session: Session = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      lastSeenAt: null,
    };

    this.sessions.set(session.id, cloneSession(session));
    return cloneSession(session);
  }

  public async findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) {
        return cloneSession(session);
      }
    }

    return null;
  }

  public async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.revokedAt = revokedAt;
    }
  }

  public async touchSession(sessionId: string, seenAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.lastSeenAt = seenAt;
    }
  }

  public async listPermissionKeysByUserId(userId: string): Promise<PermissionKey[]> {
    return [...(this.permissionKeysByUserId.get(userId) ?? [])];
  }
}

function cloneUser(user: User): User {
  return {
    ...user,
    lockedUntil: cloneDate(user.lockedUntil),
    lastLoginAt: cloneDate(user.lastLoginAt),
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    deletedAt: cloneDate(user.deletedAt),
  };
}

function cloneSession(session: Session): Session {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt),
    revokedAt: cloneDate(session.revokedAt),
    createdAt: new Date(session.createdAt),
    lastSeenAt: cloneDate(session.lastSeenAt),
  };
}

function cloneDate(date: Date | null): Date | null {
  return date ? new Date(date) : null;
}
