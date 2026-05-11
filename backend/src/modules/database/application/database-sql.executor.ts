import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { env } from "../../../config/env.js";

export type DatabaseSqlExecutor = {
  execute(sql: string, params?: SqlParameter[]): Promise<unknown>;
};

export type SqlParameter = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;

export class MySqlDatabaseExecutor implements DatabaseSqlExecutor {
  private readonly pool: Pool;

  constructor(options: PoolOptions = createDefaultPoolOptions()) {
    this.pool = mysql.createPool({
      ...options,
      multipleStatements: false,
    });
  }

  async execute(sql: string, params: SqlParameter[] = []): Promise<unknown> {
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function createDefaultPoolOptions(): PoolOptions {
  return {
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_ADMIN_USER,
    password: env.MYSQL_ADMIN_PASSWORD,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
  };
}
