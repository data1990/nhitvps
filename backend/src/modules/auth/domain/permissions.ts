import type { AuthAction, AuthModule, PermissionKey } from "./auth.types.js";

const MODULES = [
  "auth",
  "backup",
  "database",
  "file",
  "firewall",
  "monitoring",
  "nginx",
  "system",
  "user",
] as const satisfies readonly AuthModule[];

const ACTIONS = ["create", "delete", "execute", "manage", "read", "restore", "update"] as const satisfies readonly AuthAction[];

export function createPermissionKey(module: AuthModule, action: AuthAction): PermissionKey {
  return `${module}:${action}`;
}

export function parsePermissionKey(key: string): { module: AuthModule; action: AuthAction } | null {
  const [module, action, ...extra] = key.split(":");

  if (extra.length > 0 || !isAuthModule(module) || !isAuthAction(action)) {
    return null;
  }

  return {
    module,
    action,
  };
}

export function isPermissionKey(key: string): key is PermissionKey {
  return parsePermissionKey(key) !== null;
}

export function listDefaultPermissionKeys(): PermissionKey[] {
  return MODULES.flatMap((module) => ACTIONS.map((action) => createPermissionKey(module, action)));
}

function isAuthModule(value: unknown): value is AuthModule {
  return typeof value === "string" && MODULES.includes(value as AuthModule);
}

function isAuthAction(value: unknown): value is AuthAction {
  return typeof value === "string" && ACTIONS.includes(value as AuthAction);
}

