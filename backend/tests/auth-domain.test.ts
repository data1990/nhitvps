import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPermissionKey,
  isPermissionKey,
  listDefaultPermissionKeys,
  parsePermissionKey,
} from "../src/modules/auth/index.js";

describe("auth domain", () => {
  it("creates and parses permission keys", () => {
    const key = createPermissionKey("nginx", "manage");

    expect(key).toBe("nginx:manage");
    expect(isPermissionKey(key)).toBe(true);
    expect(parsePermissionKey(key)).toEqual({
      module: "nginx",
      action: "manage",
    });
  });

  it("rejects invalid permission keys", () => {
    expect(isPermissionKey("nginx:unknown")).toBe(false);
    expect(isPermissionKey("nginx:manage:extra")).toBe(false);
    expect(parsePermissionKey("bad")).toBeNull();
  });

  it("keeps default permission keys unique", () => {
    const permissions = listDefaultPermissionKeys();
    const uniquePermissions = new Set(permissions);

    expect(permissions.length).toBe(uniquePermissions.size);
    expect(permissions).toContain("file:read");
    expect(permissions).toContain("system:execute");
  });

  it("includes the required auth migration tables", async () => {
    const migrationPath = path.resolve("src/infrastructure/database/migrations/001_auth_schema.sql");
    const migration = await fs.readFile(migrationPath, "utf8");

    for (const table of [
      "users",
      "roles",
      "permissions",
      "role_permissions",
      "user_roles",
      "sessions",
      "two_factor_recovery_codes",
      "audit_logs",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});

