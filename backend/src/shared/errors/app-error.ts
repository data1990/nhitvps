import type { ApiErrorCode } from "../http/api-error.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode | string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  public constructor(options: {
    message: string;
    statusCode?: number;
    code?: ApiErrorCode | string;
    details?: unknown;
    isOperational?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "APP_ERROR";
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
  }
}
