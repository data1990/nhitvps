import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { FileManagerService } from "../application/file-manager.service.js";

const querySchema = z.object({
  root: z.string().optional(),
  path: z.string().optional(),
});

const writeSchema = z.object({
  root: z.string().optional(),
  path: z.string().min(1),
  content: z.string(),
  overwrite: z.boolean().optional(),
});

const chmodSchema = z.object({
  root: z.string().optional(),
  path: z.string().min(1),
  mode: z.string().regex(/^[0-7]{3,4}$/),
});

const chownSchema = z.object({
  root: z.string().optional(),
  path: z.string().min(1),
  uid: z.number().int().min(0).optional(),
  gid: z.number().int().min(0).optional(),
});

const zipSchema = z.object({
  root: z.string().optional(),
  sourcePaths: z.array(z.string().min(1)).min(1),
  targetPath: z.string().min(1),
  overwrite: z.boolean().optional(),
});

const unzipSchema = z.object({
  root: z.string().optional(),
  archivePath: z.string().min(1),
  targetDirectory: z.string().optional(),
  overwrite: z.boolean().optional(),
});

export async function registerFileManagerRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    roots: readonly string[];
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const fileManagerService = new FileManagerService(input.roots);
  const fileReadGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "file:read",
  });
  const fileUpdateGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "file:update",
  });

  app.get("/files/roots", { preHandler: fileReadGuard }, async () => ({
    roots: fileManagerService.listRoots(),
  }));

  app.get("/files/list", { preHandler: fileReadGuard }, async (request) => {
    const query = parseQuery(request.query);
    return await fileManagerService.listDirectory({
      root: query.root,
      targetPath: query.path ?? ".",
    });
  });

  app.get("/files/read", { preHandler: fileReadGuard }, async (request) => {
    const query = parseQuery(request.query);

    if (!query.path) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Path query is required",
        statusCode: 400,
      });
    }

    return await fileManagerService.readFile({
      root: query.root,
      targetPath: query.path,
    });
  });

  app.get("/files/download", { preHandler: fileReadGuard }, async (request, reply) => {
    const query = parseQuery(request.query);

    if (!query.path) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Path query is required",
        statusCode: 400,
      });
    }

    const download = await fileManagerService.getDownload({
      root: query.root,
      targetPath: query.path,
    });

    reply
      .header("content-type", "application/octet-stream")
      .header("content-length", download.size.toString())
      .header("content-disposition", `attachment; filename="${sanitizeHeaderValue(download.fileName)}"`);

    return reply.send(createReadStream(download.absolutePath));
  });

  app.post("/files/upload", { preHandler: fileUpdateGuard }, async (request) => {
    const file = await request.file();

    if (!file) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "File is required",
        statusCode: 400,
      });
    }

    const fields = multipartFieldsToObject(file.fields);
    const content = await file.toBuffer();

    return await fileManagerService.uploadFile({
      root: getOptionalString(fields.root),
      targetDirectory: getOptionalString(fields.path),
      fileName: file.filename,
      content,
      overwrite: getOptionalBoolean(fields.overwrite),
    });
  });

  app.post("/files/write", { preHandler: fileUpdateGuard }, async (request) => {
    const body = parseBody(writeSchema, request.body);
    return await fileManagerService.writeTextFile({
      root: body.root,
      targetPath: body.path,
      content: body.content,
      overwrite: body.overwrite,
    });
  });

  app.post("/files/chmod", { preHandler: fileUpdateGuard }, async (request) => {
    const body = parseBody(chmodSchema, request.body);
    return await fileManagerService.chmod({
      root: body.root,
      targetPath: body.path,
      mode: body.mode,
    });
  });

  app.post("/files/chown", { preHandler: fileUpdateGuard }, async (request) => {
    const body = parseBody(chownSchema, request.body);
    return await fileManagerService.chown({
      root: body.root,
      targetPath: body.path,
      uid: body.uid,
      gid: body.gid,
    });
  });

  app.post("/files/zip", { preHandler: fileUpdateGuard }, async (request) => {
    const body = parseBody(zipSchema, request.body);
    return await fileManagerService.createZip({
      root: body.root,
      sourcePaths: body.sourcePaths,
      targetPath: body.targetPath,
      overwrite: body.overwrite,
    });
  });

  app.post("/files/unzip", { preHandler: fileUpdateGuard }, async (request) => {
    const body = parseBody(unzipSchema, request.body);
    return await fileManagerService.extractZip({
      root: body.root,
      archivePath: body.archivePath,
      targetDirectory: body.targetDirectory,
      overwrite: body.overwrite,
    });
  });
}

function parseQuery(query: unknown): z.infer<typeof querySchema> {
  const parsed = querySchema.safeParse(query);

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

function sanitizeHeaderValue(value: string): string {
  return value.replace(/["\r\n]/g, "_");
}

function multipartFieldsToObject(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "object" && value !== null && "value" in value) {
      result[key] = (value as { value: unknown }).value;
    }
  }

  return result;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}
