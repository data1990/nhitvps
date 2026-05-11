import { describe, expect, it } from "vitest";
import {
  quoteMySqlIdentifier,
  validateManagedDatabase,
  validateManagedDatabaseGrant,
  validateManagedDatabaseUser,
} from "../src/modules/database/index.js";

describe("database manager model", () => {
  it("accepts safe database metadata", () => {
    const database = validateManagedDatabase({
      id: "db-1",
      name: "app_production",
      engine: "mariadb",
      charset: "utf8mb4",
      collation: "utf8mb4_unicode_ci",
      ownerUserId: "user-1",
      status: "active",
    });

    expect(database.name).toBe("app_production");
  });

  it("rejects unsafe database identifiers before SQL rendering", () => {
    expect(() => quoteMySqlIdentifier("app; DROP DATABASE mysql")).toThrowError(
      "identifier must use letters, numbers, and underscores only",
    );

    expect(() => quoteMySqlIdentifier("app`prod")).toThrowError(
      "identifier must use letters, numbers, and underscores only",
    );
  });

  it("quotes validated mysql identifiers", () => {
    expect(quoteMySqlIdentifier("tenant_001")).toBe("`tenant_001`");
  });

  it("validates database user host and secret references", () => {
    const user = validateManagedDatabaseUser({
      id: "db-user-1",
      username: "app_user",
      host: "localhost",
      authPlugin: "mysql_native_password",
      passwordSecretRef: "vault:/database/app_user",
      status: "active",
    });

    expect(user.username).toBe("app_user");

    expect(() =>
      validateManagedDatabaseUser({
        ...user,
        host: "localhost'; FLUSH PRIVILEGES; --",
      }),
    ).toThrowError("database host contains unsafe characters");
  });

  it("rejects duplicate or unknown privileges", () => {
    expect(() =>
      validateManagedDatabaseGrant({
        id: "grant-1",
        databaseId: "db-1",
        databaseUserId: "db-user-1",
        privileges: ["SELECT", "SELECT"],
      }),
    ).toThrowError("Duplicate database privileges are not allowed");

    expect(() =>
      validateManagedDatabaseGrant({
        id: "grant-2",
        databaseId: "db-1",
        databaseUserId: "db-user-1",
        privileges: ["SELECT", "GRANT OPTION" as "SELECT"],
      }),
    ).toThrowError("Invalid database privilege");
  });
});
