import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../../config/env.js";
import type { PermissionKey } from "../domain/auth.types.js";
import { AuthService } from "../application/auth.service.js";
import { AuthorizationService } from "../application/authorization.service.js";

export type AuthenticatedRequestContext = Awaited<ReturnType<AuthService["authenticate"]>>;

export function createPermissionGuard(input: {
  authService: AuthService;
  authorizationService: AuthorizationService;
  permission: PermissionKey;
}): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request) => {
    const auth = await input.authService.authenticate(readSessionCookie(request));
    await input.authorizationService.assertPermission(auth.user.id, input.permission);
    attachAuthContext(request, auth);
  };
}

function readSessionCookie(request: FastifyRequest): string | undefined {
  const cookie = request.cookies[env.SESSION_COOKIE_NAME];
  return typeof cookie === "string" ? cookie : undefined;
}

function attachAuthContext(request: FastifyRequest, auth: AuthenticatedRequestContext): void {
  (request as FastifyRequest & { auth: AuthenticatedRequestContext }).auth = auth;
}

