import { AppError } from "../../../shared/errors/app-error.js";
import type {
  DatabaseCharset,
  DatabaseCollation,
  DatabasePrivilege,
  ManagedDatabase,
  ManagedDatabaseGrant,
  ManagedDatabaseUser,
} from "./database.types.js";

const MYSQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const MYSQL_USERNAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
const MYSQL_HOST_PATTERN = /^(%|localhost|[A-Za-z0-9_.:%-]{1,255})$/;
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;

const ALLOWED_COLLATIONS = {
  utf8mb4: ["utf8mb4_unicode_ci", "utf8mb4_general_ci", "utf8mb4_0900_ai_ci"],
} as const satisfies Record<DatabaseCharset, readonly DatabaseCollation[]>;

const ALLOWED_PRIVILEGES = [
  "ALTER",
  "CREATE",
  "CREATE TEMPORARY TABLES",
  "DELETE",
  "DROP",
  "EXECUTE",
  "INDEX",
  "INSERT",
  "LOCK TABLES",
  "REFERENCES",
  "SELECT",
  "SHOW VIEW",
  "TRIGGER",
  "UPDATE",
] as const satisfies readonly DatabasePrivilege[];

export function validateManagedDatabase(database: ManagedDatabase): ManagedDatabase {
  assertDatabaseIdentifier(database.name, "database name");

  if (!ALLOWED_COLLATIONS[database.charset].includes(database.collation)) {
    throwValidation("Invalid database collation for charset");
  }

  return database;
}

export function validateManagedDatabaseUser(user: ManagedDatabaseUser): ManagedDatabaseUser {
  assertDatabaseUsername(user.username);
  assertDatabaseHost(user.host);

  if (user.passwordSecretRef !== null) {
    assertSafeSecretRef(user.passwordSecretRef);
  }

  return user;
}

export function validateManagedDatabaseGrant(grant: ManagedDatabaseGrant): ManagedDatabaseGrant {
  if (grant.privileges.length === 0) {
    throwValidation("At least one database privilege is required");
  }

  const uniquePrivileges = new Set(grant.privileges);

  if (uniquePrivileges.size !== grant.privileges.length) {
    throwValidation("Duplicate database privileges are not allowed");
  }

  for (const privilege of grant.privileges) {
    if (!ALLOWED_PRIVILEGES.includes(privilege)) {
      throwValidation("Invalid database privilege");
    }
  }

  return grant;
}

export function assertDatabaseIdentifier(value: string, label = "identifier"): void {
  if (!MYSQL_IDENTIFIER_PATTERN.test(value)) {
    throwValidation(`${label} must use letters, numbers, and underscores only`);
  }
}

export function assertDatabaseUsername(value: string): void {
  if (!MYSQL_USERNAME_PATTERN.test(value)) {
    throwValidation("database username must use letters, numbers, and underscores only");
  }
}

export function assertDatabaseHost(value: string): void {
  if (!MYSQL_HOST_PATTERN.test(value) || value.includes("..")) {
    throwValidation("database host contains unsafe characters");
  }
}

export function assertBackupChecksum(value: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throwValidation("backup checksum must be a SHA-256 hex digest");
  }
}

export function quoteMySqlIdentifier(value: string): string {
  assertDatabaseIdentifier(value);
  return `\`${value}\``;
}

function assertSafeSecretRef(value: string): void {
  if (!/^[A-Za-z0-9._:/@-]{1,255}$/.test(value)) {
    throwValidation("password secret reference contains unsafe characters");
  }
}

function throwValidation(message: string): never {
  throw new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: 400,
  });
}
