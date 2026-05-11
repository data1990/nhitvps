import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuthService } from "../application/auth.service.js";
import type { AuthRepository } from "../application/auth.repository.js";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(1024),
});

export async function registerAuthRoutes(app: FastifyInstance, repository: AuthRepository): Promise<void> {
  const authService = new AuthService(repository);

  app.post("/auth/login", async (request, reply) => {
    const body = parseBody(loginSchema, request.body);
    const result = await authService.login({
      identifier: body.identifier,
      password: body.password,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    setSessionCookie(reply, result.token, result.session.expiresAt);

    return {
      user: result.user,
      session: {
        expiresAt: result.session.expiresAt.toISOString(),
      },
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    await authService.logout(readSessionCookie(request));
    clearSessionCookie(reply);

    return {
      status: "ok",
    };
  });

  app.get("/auth/me", async (request) => {
    const result = await authService.authenticate(readSessionCookie(request));

    return {
      user: result.user,
      session: {
        expiresAt: result.session.expiresAt.toISOString(),
      },
    };
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

function readSessionCookie(request: FastifyRequest): string | undefined {
  const cookie = request.cookies[env.SESSION_COOKIE_NAME];
  return typeof cookie === "string" ? cookie : undefined;
}

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(env.SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookie(),
    expires: expiresAt,
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(env.SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookie(),
  });
}

function shouldUseSecureCookie(): boolean {
  if (env.SESSION_COOKIE_SECURE === "true") {
    return true;
  }

  if (env.SESSION_COOKIE_SECURE === "false") {
    return false;
  }

  return env.NODE_ENV === "production";
}
