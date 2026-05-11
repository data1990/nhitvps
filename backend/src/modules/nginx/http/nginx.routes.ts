import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { LetsEncryptService } from "../application/lets-encrypt.service.js";
import { NginxConfigService, type NginxConfigPaths } from "../application/nginx-config.service.js";
import { NginxRuntimeService, type CommandExecutor } from "../application/nginx-runtime.service.js";

const createSiteSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  mode: z.enum(["static", "reverse_proxy"]),
  documentRoot: z.string().optional(),
  upstreamUrl: z.string().optional(),
  sslMode: z.enum(["none", "lets_encrypt", "custom"]).default("none"),
  accessLogPath: z.string().min(1),
  errorLogPath: z.string().min(1),
  enabled: z.boolean().default(true),
});

const letsEncryptSchema = z.object({
  domain: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  email: z.string().email(),
  redirect: z.boolean().optional(),
  staging: z.boolean().optional(),
});

export async function registerNginxRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    paths?: Partial<NginxConfigPaths>;
    commandExecutor?: CommandExecutor;
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const nginxConfigService = new NginxConfigService(input.paths);
  const nginxRuntimeService = new NginxRuntimeService(input.commandExecutor);
  const letsEncryptService = new LetsEncryptService(input.commandExecutor);
  const nginxUpdateGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "nginx:update",
  });
  const nginxExecuteGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "nginx:execute",
  });

  app.post("/nginx/sites", { preHandler: nginxUpdateGuard }, async (request) => {
    const body = parseBody(createSiteSchema, request.body);
    const result = await nginxConfigService.createOrUpdateVhost({
      id: body.id,
      domain: body.domain,
      aliases: body.aliases ?? [],
      mode: body.mode,
      documentRoot: body.documentRoot,
      upstreamUrl: body.upstreamUrl,
      sslMode: body.sslMode ?? "none",
      accessLogPath: body.accessLogPath,
      errorLogPath: body.errorLogPath,
      enabled: body.enabled ?? true,
    });

    return {
      fileName: result.fileName,
      availablePath: result.availablePath,
      enabledPath: result.enabledPath,
      backupPath: result.backupPath,
    };
  });

  app.post("/nginx/test", { preHandler: nginxExecuteGuard }, async () => await nginxRuntimeService.testConfig());

  app.post("/nginx/reload", { preHandler: nginxExecuteGuard }, async () => await nginxRuntimeService.reload());

  app.post("/nginx/restart", { preHandler: nginxExecuteGuard }, async () => await nginxRuntimeService.restart());

  app.post("/nginx/ssl/lets-encrypt", { preHandler: nginxUpdateGuard }, async (request) => {
    const body = parseBody(letsEncryptSchema, request.body);
    return await letsEncryptService.issueCertificate({
      domain: body.domain,
      aliases: body.aliases ?? [],
      email: body.email,
      redirect: body.redirect,
      staging: body.staging,
    });
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
