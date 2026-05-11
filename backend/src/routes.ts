import type { FastifyInstance } from "fastify";
import type { AuthRepository } from "./modules/auth/index.js";
import { registerAuthRoutes } from "./modules/auth/http/auth.routes.js";
import {
  registerDatabaseRoutes,
  type DatabaseBackupCommandExecutor,
  type DatabaseBackupOptions,
  type DatabaseSqlExecutor,
} from "./modules/database/index.js";
import { registerDocsRoutes } from "./modules/docs/index.js";
import { registerFileManagerRoutes } from "./modules/file-manager/index.js";
import { registerFirewallRoutes, type FirewallCommandExecutor } from "./modules/firewall/index.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerMonitoringRoutes, type SystemMetricsOptions } from "./modules/monitoring/index.js";
import { registerNginxRoutes, type CommandExecutor, type NginxConfigPaths } from "./modules/nginx/index.js";
import { registerSystemRoutes, type SystemPackageCommandExecutor } from "./modules/system/index.js";

export type RouteDependencies = {
  authRepository: AuthRepository;
  fileManagerRoots: readonly string[];
  nginxConfigPaths?: Partial<NginxConfigPaths>;
  nginxCommandExecutor?: CommandExecutor;
  databaseSqlExecutor?: DatabaseSqlExecutor;
  databaseBackupCommandExecutor?: DatabaseBackupCommandExecutor;
  databaseBackupOptions?: Partial<DatabaseBackupOptions>;
  firewallCommandExecutor?: FirewallCommandExecutor;
  metricsOptions?: Partial<SystemMetricsOptions>;
  systemPackageCommandExecutor?: SystemPackageCommandExecutor;
};

export async function registerRoutes(app: FastifyInstance, dependencies: RouteDependencies): Promise<void> {
  await app.register(registerHealthRoutes, { prefix: "/api/v1" });
  await app.register(registerDocsRoutes, { prefix: "/api/v1" });
  await app.register(async (authApp) => registerAuthRoutes(authApp, dependencies.authRepository), {
    prefix: "/api/v1",
  });
  await app.register(
    async (fileApp) =>
      registerFileManagerRoutes(fileApp, {
        authRepository: dependencies.authRepository,
        roots: dependencies.fileManagerRoots,
      }),
    {
      prefix: "/api/v1",
    },
  );
  await app.register(
    async (nginxApp) =>
      registerNginxRoutes(nginxApp, {
        authRepository: dependencies.authRepository,
        paths: dependencies.nginxConfigPaths,
        commandExecutor: dependencies.nginxCommandExecutor,
      }),
    {
      prefix: "/api/v1",
    },
  );
  await app.register(
    async (databaseApp) =>
      registerDatabaseRoutes(databaseApp, {
        authRepository: dependencies.authRepository,
        executor: dependencies.databaseSqlExecutor,
        backupCommandExecutor: dependencies.databaseBackupCommandExecutor,
        backupOptions: dependencies.databaseBackupOptions,
      }),
    {
      prefix: "/api/v1",
    },
  );
  await app.register(
    async (firewallApp) =>
      registerFirewallRoutes(firewallApp, {
        authRepository: dependencies.authRepository,
        commandExecutor: dependencies.firewallCommandExecutor,
      }),
    {
      prefix: "/api/v1",
    },
  );
  await app.register(
    async (monitoringApp) =>
      registerMonitoringRoutes(monitoringApp, {
        authRepository: dependencies.authRepository,
        metricsOptions: dependencies.metricsOptions,
      }),
    {
      prefix: "/api/v1",
    },
  );
  await app.register(
    async (systemApp) =>
      registerSystemRoutes(systemApp, {
        authRepository: dependencies.authRepository,
        commandExecutor: dependencies.systemPackageCommandExecutor,
      }),
    {
      prefix: "/api/v1",
    },
  );
}
