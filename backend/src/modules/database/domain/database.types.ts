export type DatabaseEngine = "mysql" | "mariadb";

export type DatabaseCharset = "utf8mb4";

export type DatabaseCollation =
  | "utf8mb4_unicode_ci"
  | "utf8mb4_general_ci"
  | "utf8mb4_0900_ai_ci";

export type ManagedDatabaseStatus = "active" | "disabled" | "pending_delete";

export type ManagedDatabaseUserStatus = "active" | "locked" | "disabled";

export type DatabaseUserAuthPlugin =
  | "caching_sha2_password"
  | "ed25519"
  | "mysql_native_password"
  | "unix_socket";

export type DatabasePrivilege =
  | "ALTER"
  | "CREATE"
  | "CREATE TEMPORARY TABLES"
  | "DELETE"
  | "DROP"
  | "EXECUTE"
  | "INDEX"
  | "INSERT"
  | "LOCK TABLES"
  | "REFERENCES"
  | "SELECT"
  | "SHOW VIEW"
  | "TRIGGER"
  | "UPDATE";

export type ManagedDatabase = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  charset: DatabaseCharset;
  collation: DatabaseCollation;
  ownerUserId: string | null;
  status: ManagedDatabaseStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ManagedDatabaseUser = {
  id: string;
  username: string;
  host: string;
  authPlugin: DatabaseUserAuthPlugin;
  passwordSecretRef: string | null;
  status: ManagedDatabaseUserStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ManagedDatabaseGrant = {
  id: string;
  databaseId: string;
  databaseUserId: string;
  privileges: DatabasePrivilege[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type DatabaseBackupStatus = "created" | "failed" | "restored" | "verified";

export type DatabaseBackupMetadata = {
  id: string;
  databaseId: string;
  filePath: string;
  checksumSha256: string;
  sizeBytes: number;
  status: DatabaseBackupStatus;
  createdAt?: Date;
};

export type SlowQuerySettings = {
  databaseId: string;
  enabled: boolean;
  longQueryTimeMs: number;
  logOutput: "file" | "table";
  updatedAt?: Date;
};
