import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import {
  DatabaseBackupService,
  type DatabaseBackupCommandExecutor,
  type DatabaseBackupOptions,
} from "../application/database-backup.service.js";
import { DatabaseProvisioningService } from "../application/database-provisioning.service.js";
import type { DatabaseSqlExecutor } from "../application/database-sql.executor.js";

const databaseSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(64),
  charset: z.enum(["utf8mb4"]).default("utf8mb4"),
  collation: z.enum(["utf8mb4_unicode_ci", "utf8mb4_general_ci", "utf8mb4_0900_ai_ci"]).default("utf8mb4_unicode_ci"),
  ownerUserId: z.string().min(1).nullable().optional(),
});

const userSchema = z.object({
  id: z.string().min(1).optional(),
  username: z.string().min(1).max(32),
  host: z.string().min(1).max(255).default("localhost"),
  password: z.string().min(16).max(256),
});

const grantSchema = z.object({
  databaseName: z.string().min(1).max(64),
  username: z.string().min(1).max(32),
  host: z.string().min(1).max(255).default("localhost"),
  privileges: z
    .array(
      z.enum([
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
      ]),
    )
    .min(1),
});

const provisionSchema = databaseSchema.merge(userSchema).extend({
  privileges: grantSchema.shape.privileges.optional(),
});

const backupSchema = z.object({
  databaseName: z.string().min(1).max(64),
});

const restoreSchema = z.object({
  backupPath: z.string().min(1),
  checksumSha256: z.string().length(64).optional(),
});

export async function registerDatabaseRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    executor?: DatabaseSqlExecutor;
    backupCommandExecutor?: DatabaseBackupCommandExecutor;
    backupOptions?: Partial<DatabaseBackupOptions>;
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const databaseCreateGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "database:create",
  });
  const backupCreateGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "backup:create",
  });
  const databaseRestoreGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "database:restore",
  });
  const provisioningService = new DatabaseProvisioningService(input.executor);
  const backupService = new DatabaseBackupService(input.backupCommandExecutor, input.backupOptions);

  app.post("/databases", { preHandler: databaseCreateGuard }, async (request) => {
    return await provisioningService.createDatabase(parseBody(databaseSchema, request.body));
  });

  app.post("/databases/users", { preHandler: databaseCreateGuard }, async (request) => {
    return await provisioningService.createUser(parseBody(userSchema, request.body));
  });

  app.post("/databases/grants", { preHandler: databaseCreateGuard }, async (request) => {
    return {
      privileges: await provisioningService.grantPrivileges(parseBody(grantSchema, request.body)),
    };
  });

  app.post("/databases/provision", { preHandler: databaseCreateGuard }, async (request) => {
    return await provisioningService.provisionDatabase(parseBody(provisionSchema, request.body));
  });

  app.post("/databases/backups", { preHandler: backupCreateGuard }, async (request) => {
    return await backupService.backupDatabase(parseBody(backupSchema, request.body));
  });

  app.post("/databases/restore", { preHandler: databaseRestoreGuard }, async (request) => {
    return await backupService.restoreDatabase(parseBody(restoreSchema, request.body));
  });
}

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      statusCode: 400,
      details: parsed.error.flatten(),
    });
  }

  return parsed.data;
}
