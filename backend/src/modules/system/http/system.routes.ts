import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import {
  SystemPackageManagerService,
  type SystemComponent,
  type SystemPackageCommandExecutor,
} from "../application/package-manager.service.js";

const componentSchema = z.enum(["certbot", "mariadb", "mysql", "nginx", "ufw"]);

const statusQuerySchema = z.object({
  component: componentSchema.optional(),
});

const installSchema = z.object({
  component: componentSchema,
  startService: z.boolean().optional(),
});

const installStackSchema = z.object({
  components: z.array(componentSchema).min(1).default(["nginx", "mysql", "ufw", "certbot"]),
});

export async function registerSystemRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    commandExecutor?: SystemPackageCommandExecutor;
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const systemManageGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "system:manage",
  });
  const packageManager = new SystemPackageManagerService(input.commandExecutor);

  app.get("/system/packages/status", { preHandler: systemManageGuard }, async (request) => {
    const query = parse(statusQuerySchema, request.query);
    const components: SystemComponent[] = query.component ? [query.component] : ["nginx", "mysql", "mariadb", "ufw", "certbot"];
    return {
      components: await Promise.all(components.map((component) => packageManager.status(component))),
    };
  });

  app.post("/system/packages/install", { preHandler: systemManageGuard }, async (request) => {
    const body = parse(installSchema, request.body);
    return await packageManager.install(body.component, {
      startService: body.startService,
    });
  });

  app.post("/system/packages/install-stack", { preHandler: systemManageGuard }, async (request) => {
    const body = parse(installStackSchema, request.body ?? {});
    return {
      results: await packageManager.installStack(body.components ?? ["nginx", "mysql", "ufw", "certbot"]),
    };
  });
}

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

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
