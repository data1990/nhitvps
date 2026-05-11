export type ApiErrorCode =
  | "APP_ERROR"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_REQUIRED"
  | "BAD_REQUEST"
  | "COMMAND_BLOCKED"
  | "COMMAND_FAILED"
  | "COMMAND_TIMEOUT"
  | "CONFIG_ERROR"
  | "FORBIDDEN_PATH"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "INVALID_PATH"
  | "ROUTE_NOT_FOUND"
  | "VALIDATION_ERROR";

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode | string;
    message: string;
    requestId: string;
    details?: unknown;
    stack?: string;
  };
};

export function createApiErrorResponse(input: {
  code: ApiErrorCode | string;
  message: string;
  requestId: string;
  details?: unknown;
  stack?: string;
}): ApiErrorResponse {
  const response: ApiErrorResponse = {
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
    },
  };

  if (input.details !== undefined) {
    response.error.details = input.details;
  }

  if (input.stack !== undefined) {
    response.error.stack = input.stack;
  }

  return response;
}
