import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./config/env.js";
import { createDefaultAuthRepository, type AuthRepository } from "./modules/auth/index.js";
import type { DatabaseBackupCommandExecutor, DatabaseBackupOptions, DatabaseSqlExecutor } from "./modules/database/index.js";
import type { FirewallCommandExecutor } from "./modules/firewall/index.js";
import type { SystemMetricsOptions } from "./modules/monitoring/index.js";
import type { CommandExecutor, NginxConfigPaths } from "./modules/nginx/index.js";
import { AutoBackupScheduler } from "./modules/operations/index.js";
import type { SystemPackageCommandExecutor } from "./modules/system/index.js";
import { registerCookiePlugin } from "./plugins/cookie.js";
import { registerMultipartPlugin } from "./plugins/multipart.js";
import { registerSecurityPlugins } from "./plugins/security.js";
import { registerWebSocketPlugin } from "./plugins/websocket.js";
import { registerRequestIdPlugin } from "./plugins/request-id.js";
import { registerErrorHandler } from "./shared/errors/error-handler.js";
import { registerRoutes } from "./routes.js";

export type AppDependencies = {
  authRepository?: AuthRepository;
  fileManagerRoots?: readonly string[];
  nginxConfigPaths?: Partial<NginxConfigPaths>;
  nginxCommandExecutor?: CommandExecutor;
  databaseSqlExecutor?: DatabaseSqlExecutor;
  databaseBackupCommandExecutor?: DatabaseBackupCommandExecutor;
  databaseBackupOptions?: Partial<DatabaseBackupOptions>;
  firewallCommandExecutor?: FirewallCommandExecutor;
  metricsOptions?: Partial<SystemMetricsOptions>;
  systemPackageCommandExecutor?: SystemPackageCommandExecutor;
};

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.token",
          "req.body.secret",
        ],
        censor: "[redacted]",
      },
    },
    requestIdHeader: "x-request-id",
  });

  registerErrorHandler(app);
  await registerRequestIdPlugin(app);
  await registerCookiePlugin(app);
  await registerMultipartPlugin(app);
  await registerSecurityPlugins(app);
  await registerWebSocketPlugin(app);
  await registerRoutes(app, {
    authRepository: dependencies.authRepository ?? (await createDefaultAuthRepository()),
    fileManagerRoots: dependencies.fileManagerRoots ?? env.FILE_MANAGER_ROOTS,
    nginxConfigPaths: dependencies.nginxConfigPaths,
    nginxCommandExecutor: dependencies.nginxCommandExecutor,
    databaseSqlExecutor: dependencies.databaseSqlExecutor,
    databaseBackupCommandExecutor: dependencies.databaseBackupCommandExecutor,
    databaseBackupOptions: dependencies.databaseBackupOptions,
    firewallCommandExecutor: dependencies.firewallCommandExecutor,
    metricsOptions: dependencies.metricsOptions,
    systemPackageCommandExecutor: dependencies.systemPackageCommandExecutor,
  });

  if (env.AUTO_BACKUP_ENABLED) {
    const scheduler = new AutoBackupScheduler(
      undefined,
      dependencies.nginxConfigPaths?.sitesAvailableDir
        ? {
            nginxSitesAvailableDir: dependencies.nginxConfigPaths.sitesAvailableDir,
          }
        : {},
    );
    scheduler.start();
    app.addHook("onClose", async () => {
      scheduler.stop();
    });
  }

  return app;
}
