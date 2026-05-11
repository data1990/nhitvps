import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { createApiErrorResponse } from "../http/api-error.js";
import { AppError } from "./app-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) => {
    await reply.status(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route ${request.method} ${request.url} was not found`,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler(async (error, request, reply) => {
    await handleError(error, request, reply);
  });
}

async function handleError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isAppError = error instanceof AppError;
  const errorLike = toErrorLike(error);
  const statusCode = normalizeStatusCode(isAppError ? error.statusCode : errorLike.statusCode);
  const code = resolveErrorCode(errorLike, isAppError ? error.code : undefined, statusCode);
  const message =
    statusCode >= 500 && env.NODE_ENV === "production" ? "Internal server error" : errorLike.message;

  if (statusCode >= 500) {
    request.log.error({ err: error }, "request failed");
  } else {
    request.log.warn({ err: error }, "request rejected");
  }

  const payload = createApiErrorResponse({
    code,
    message,
    requestId: request.id,
    details: isAppError ? error.details : errorLike.validationDetails,
    stack: env.NODE_ENV !== "production" ? errorLike.stack : undefined,
  });

  await reply.status(statusCode).send(payload);
}

function toErrorLike(error: unknown): {
  message: string;
  stack?: string;
  statusCode?: number;
  code?: string;
  validationDetails?: unknown;
} {
  if (error instanceof Error) {
    const maybeStatus = error as Error & {
      code?: unknown;
      statusCode?: unknown;
      validation?: unknown;
    };

    return {
      message: error.message,
      stack: error.stack,
      code: typeof maybeStatus.code === "string" ? maybeStatus.code : undefined,
      statusCode: typeof maybeStatus.statusCode === "number" ? maybeStatus.statusCode : undefined,
      validationDetails: maybeStatus.validation,
    };
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      code?: unknown;
      message?: unknown;
      stack?: unknown;
      statusCode?: unknown;
      validation?: unknown;
    };

    return {
      message: typeof maybeError.message === "string" ? maybeError.message : "Unknown error",
      code: typeof maybeError.code === "string" ? maybeError.code : undefined,
      stack: typeof maybeError.stack === "string" ? maybeError.stack : undefined,
      statusCode: typeof maybeError.statusCode === "number" ? maybeError.statusCode : undefined,
      validationDetails: maybeError.validation,
    };
  }

  return {
    message: "Unknown error",
  };
}

function normalizeStatusCode(statusCode: number | undefined): number {
  if (!statusCode || statusCode < 400 || statusCode > 599) {
    return 500;
  }

  return statusCode;
}

function resolveErrorCode(
  errorLike: { code?: string; validationDetails?: unknown },
  appCode: string | undefined,
  statusCode: number,
): string {
  if (appCode) {
    return appCode;
  }

  if (errorLike.validationDetails !== undefined || errorLike.code === "FST_ERR_VALIDATION") {
    return "VALIDATION_ERROR";
  }

  if (statusCode === 400) {
    return "BAD_REQUEST";
  }

  return "INTERNAL_SERVER_ERROR";
}
