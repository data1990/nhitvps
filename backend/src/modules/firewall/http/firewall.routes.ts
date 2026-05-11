import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { UfwFirewallAdapter, type FirewallCommandExecutor } from "../application/ufw-firewall.adapter.js";
import type { FirewallRule } from "../domain/firewall.types.js";

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ip"), value: z.string().min(1) }),
  z.object({ kind: z.literal("cidr"), value: z.string().min(1) }),
  z.object({ kind: z.literal("country"), value: z.string().min(2).max(2) }),
  z.object({ kind: z.literal("port"), value: z.number().int() }),
  z.object({ kind: z.literal("port_range"), from: z.number().int(), to: z.number().int() }),
]);

const portSchema = z.union([z.number().int(), z.object({ from: z.number().int(), to: z.number().int() })]);

const firewallRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  type: z.enum([
    "blacklist",
    "whitelist",
    "rate_limit",
    "geo_block",
    "ssh_protection",
    "ddos_protection",
    "botnet_block",
  ]),
  action: z.enum(["allow", "deny", "limit", "log"]),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  protocol: z.enum(["tcp", "udp", "icmp", "all"]).default("tcp"),
  targets: z.array(targetSchema).min(1),
  ports: z.array(portSchema).default([]),
  rateLimit: z
    .object({
      requests: z.number().int(),
      windowSeconds: z.number().int(),
      burst: z.number().int(),
    })
    .optional(),
  priority: z.number().int().default(1000),
  status: z.enum(["enabled", "disabled", "pending_apply", "failed"]).default("pending_apply"),
  description: z.string().max(500).optional(),
  createdByUserId: z.string().min(1).nullable().optional(),
});

type FirewallRulePayload = Omit<FirewallRule, "direction" | "ports" | "priority" | "protocol" | "status"> &
  Partial<Pick<FirewallRule, "direction" | "ports" | "priority" | "protocol" | "status">>;

export async function registerFirewallRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    commandExecutor?: FirewallCommandExecutor;
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const firewallReadGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "firewall:read",
  });
  const firewallUpdateGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "firewall:update",
  });
  const adapter = new UfwFirewallAdapter(input.commandExecutor);

  app.get("/firewall/status", { preHandler: firewallReadGuard }, async () => await adapter.status());

  app.post("/firewall/rules/apply", { preHandler: firewallUpdateGuard }, async (request) => {
    return await adapter.applyRule(toFirewallRule(parseBody(firewallRuleSchema, request.body)));
  });
}

function toFirewallRule(input: FirewallRulePayload): FirewallRule {
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    action: input.action,
    direction: input.direction ?? "inbound",
    protocol: input.protocol ?? "tcp",
    targets: input.targets,
    ports: input.ports ?? [],
    rateLimit: input.rateLimit,
    priority: input.priority ?? 1000,
    status: input.status ?? "pending_apply",
    description: input.description,
    createdByUserId: input.createdByUserId,
  };
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
