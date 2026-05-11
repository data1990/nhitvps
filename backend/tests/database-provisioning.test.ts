import { describe, expect, it } from "vitest";
import { DatabaseProvisioningService, type DatabaseSqlExecutor, type SqlParameter } from "../src/modules/database/index.js";

describe("database provisioning service", () => {
  it("creates database, user, and grants privileges without putting password in SQL text", async () => {
    const executor = new RecordingDatabaseExecutor();
    const service = new DatabaseProvisioningService(executor);

    const result = await service.provisionDatabase({
      id: "db-1",
      name: "app_prod",
      username: "app_user",
      host: "localhost",
      password: "Str0ngDatabasePass!",
      privileges: ["SELECT", "INSERT"],
    });

    expect(result.database.name).toBe("app_prod");
    expect(result.user.username).toBe("app_user");
    expect(executor.calls.map((call) => call.sql)).toEqual([
      "CREATE DATABASE `app_prod` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE USER ?@? IDENTIFIED BY ?",
      "GRANT SELECT, INSERT ON `app_prod`.* TO ?@?",
    ]);
    expect(executor.calls[1]?.params).toEqual(["app_user", "localhost", "Str0ngDatabasePass!"]);
    expect(executor.calls.map((call) => call.sql).join("\n")).not.toContain("Str0ngDatabasePass!");
  });

  it("rejects unsafe database names before execution", async () => {
    const executor = new RecordingDatabaseExecutor();
    const service = new DatabaseProvisioningService(executor);

    await expect(
      service.createDatabase({
        name: "app;DROP_DATABASE_mysql",
      }),
    ).rejects.toThrowError("database name must use letters, numbers, and underscores only");
    expect(executor.calls).toHaveLength(0);
  });

  it("rolls back created resources when grant fails", async () => {
    const executor = new RecordingDatabaseExecutor({
      failOnSqlPrefix: "GRANT",
    });
    const service = new DatabaseProvisioningService(executor);

    await expect(
      service.provisionDatabase({
        name: "rollback_db",
        username: "rollback_user",
        password: "Str0ngDatabasePass!",
      }),
    ).rejects.toThrowError("forced failure");

    expect(executor.calls.map((call) => call.sql)).toEqual([
      "CREATE DATABASE `rollback_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE USER ?@? IDENTIFIED BY ?",
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `rollback_db`.* TO ?@?",
      "DROP USER ?@?",
      "DROP DATABASE `rollback_db`",
    ]);
  });
});

class RecordingDatabaseExecutor implements DatabaseSqlExecutor {
  readonly calls: Array<{ sql: string; params: SqlParameter[] }> = [];

  constructor(private readonly options: { failOnSqlPrefix?: string } = {}) {}

  async execute(sql: string, params: SqlParameter[] = []): Promise<unknown> {
    this.calls.push({ sql, params });

    if (this.options.failOnSqlPrefix && sql.startsWith(this.options.failOnSqlPrefix)) {
      throw new Error("forced failure");
    }

    return {};
  }
}
