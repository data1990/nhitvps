export type AuthModule =
  | "auth"
  | "backup"
  | "database"
  | "file"
  | "firewall"
  | "monitoring"
  | "nginx"
  | "system"
  | "user";

export type AuthAction =
  | "create"
  | "delete"
  | "execute"
  | "manage"
  | "read"
  | "restore"
  | "update";

export type PermissionKey = `${AuthModule}:${AuthAction}`;

export type UserStatus = "active" | "disabled" | "locked" | "pending";

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecretEncrypted: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Permission = {
  id: string;
  key: PermissionKey;
  module: AuthModule;
  action: AuthAction;
  description: string | null;
  createdAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastSeenAt: Date | null;
};

