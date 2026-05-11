import { AppError } from "../../../shared/errors/app-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { PermissionKey } from "../domain/auth.types.js";
import { createPermissionKey, parsePermissionKey } from "../domain/permissions.js";

export class AuthorizationService {
  public constructor(private readonly repository: AuthRepository) {}

  public async hasPermission(userId: string, requiredPermission: PermissionKey): Promise<boolean> {
    const grantedPermissions = await this.repository.listPermissionKeysByUserId(userId);
    return hasGrantedPermission(grantedPermissions, requiredPermission);
  }

  public async assertPermission(userId: string, requiredPermission: PermissionKey): Promise<void> {
    if (!(await this.hasPermission(userId, requiredPermission))) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Permission denied",
        statusCode: 403,
      });
    }
  }
}

export function hasGrantedPermission(
  grantedPermissions: readonly PermissionKey[],
  requiredPermission: PermissionKey,
): boolean {
  if (grantedPermissions.includes(requiredPermission) || grantedPermissions.includes("system:manage")) {
    return true;
  }

  const parsed = parsePermissionKey(requiredPermission);

  if (!parsed) {
    return false;
  }

  return grantedPermissions.includes(createPermissionKey(parsed.module, "manage"));
}

