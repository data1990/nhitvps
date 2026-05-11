import { randomUUID } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";
import type {
  DatabaseCharset,
  DatabaseCollation,
  DatabasePrivilege,
  ManagedDatabase,
  ManagedDatabaseUser,
} from "../domain/database.types.js";
import {
  assertDatabaseHost,
  assertDatabaseIdentifier,
  assertDatabaseUsername,
  quoteMySqlIdentifier,
  validateManagedDatabase,
  validateManagedDatabaseGrant,
  validateManagedDatabaseUser,
} from "../domain/database.validators.js";
import { MySqlDatabaseExecutor, type DatabaseSqlExecutor } from "./database-sql.executor.js";

export type CreateDatabaseInput = {
  id?: string;
  name: string;
  charset?: DatabaseCharset;
  collation?: DatabaseCollation;
  ownerUserId?: string | null;
};

export type CreateDatabaseUserInput = {
  id?: string;
  username: string;
  host?: string;
  password: string;
};

export type GrantDatabasePrivilegesInput = {
  databaseName: string;
  username: string;
  host?: string;
  privileges: DatabasePrivilege[];
};

export type ProvisionDatabaseInput = CreateDatabaseInput &
  CreateDatabaseUserInput & {
    privileges?: DatabasePrivilege[];
  };

export type ProvisionDatabaseResult = {
  database: ManagedDatabase;
  user: Omit<ManagedDatabaseUser, "passwordSecretRef">;
  privileges: DatabasePrivilege[];
};

export class DatabaseProvisioningService {
  private readonly executor: DatabaseSqlExecutor;

  constructor(executor: DatabaseSqlExecutor = new MySqlDatabaseExecutor()) {
    this.executor = executor;
  }

  async createDatabase(input: CreateDatabaseInput): Promise<ManagedDatabase> {
    const database = validateManagedDatabase({
      id: input.id ?? randomUUID(),
      name: input.name,
      engine: "mariadb",
      charset: input.charset ?? "utf8mb4",
      collation: input.collation ?? "utf8mb4_unicode_ci",
      ownerUserId: input.ownerUserId ?? null,
      status: "active",
    });

    const sql = `CREATE DATABASE ${quoteMySqlIdentifier(database.name)} CHARACTER SET ${database.charset} COLLATE ${database.collation}`;
    await this.executor.execute(sql);

    return database;
  }

  async createUser(input: CreateDatabaseUserInput): Promise<Omit<ManagedDatabaseUser, "passwordSecretRef">> {
    assertStrongDatabasePassword(input.password);

    const user = validateManagedDatabaseUser({
      id: input.id ?? randomUUID(),
      username: input.username,
      host: input.host ?? "localhost",
      authPlugin: "mysql_native_password",
      passwordSecretRef: null,
      status: "active",
    });

    await this.executor.execute("CREATE USER ?@? IDENTIFIED BY ?", [user.username, user.host, input.password]);

    return {
      id: user.id,
      username: user.username,
      host: user.host,
      authPlugin: user.authPlugin,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async grantPrivileges(input: GrantDatabasePrivilegesInput): Promise<DatabasePrivilege[]> {
    assertDatabaseIdentifier(input.databaseName, "database name");
    assertDatabaseUsername(input.username);
    assertDatabaseHost(input.host ?? "localhost");
    validateManagedDatabaseGrant({
      id: randomUUID(),
      databaseId: "runtime",
      databaseUserId: "runtime",
      privileges: input.privileges,
    });

    const sql = `GRANT ${input.privileges.join(", ")} ON ${quoteMySqlIdentifier(input.databaseName)}.* TO ?@?`;
    await this.executor.execute(sql, [input.username, input.host ?? "localhost"]);

    return input.privileges;
  }

  async provisionDatabase(input: ProvisionDatabaseInput): Promise<ProvisionDatabaseResult> {
    const privileges = input.privileges ?? ["SELECT", "INSERT", "UPDATE", "DELETE"];
    let databaseCreated = false;
    let userCreated = false;

    try {
      const database = await this.createDatabase(input);
      databaseCreated = true;

      const user = await this.createUser(input);
      userCreated = true;

      const grantedPrivileges = await this.grantPrivileges({
        databaseName: database.name,
        username: user.username,
        host: user.host,
        privileges,
      });

      return {
        database,
        user,
        privileges: grantedPrivileges,
      };
    } catch (error) {
      await this.rollbackProvisioning(input, {
        databaseCreated,
        userCreated,
      });
      throw error;
    }
  }

  private async rollbackProvisioning(
    input: ProvisionDatabaseInput,
    state: { databaseCreated: boolean; userCreated: boolean },
  ): Promise<void> {
    const host = input.host ?? "localhost";

    try {
      if (state.userCreated) {
        assertDatabaseUsername(input.username);
        assertDatabaseHost(host);
        await this.executor.execute("DROP USER ?@?", [input.username, host]);
      }

      if (state.databaseCreated) {
        assertDatabaseIdentifier(input.name, "database name");
        await this.executor.execute(`DROP DATABASE ${quoteMySqlIdentifier(input.name)}`);
      }
    } catch {
      throw new AppError({
        code: "DATABASE_ROLLBACK_FAILED",
        message: "Database provisioning failed and rollback did not complete",
        statusCode: 500,
      });
    }
  }
}

function assertStrongDatabasePassword(value: string): void {
  if (value.length < 16 || value.length > 256) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "database password must be between 16 and 256 characters",
      statusCode: 400,
    });
  }
}
