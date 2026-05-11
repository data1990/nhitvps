import { env } from "../../../config/env.js";
import { CommandRunner, type CommandPolicy, type CommandRequest, type CommandResult } from "../../../infrastructure/command/index.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { FirewallRule, FirewallTarget } from "../domain/firewall.types.js";
import { validateFirewallRule } from "../domain/firewall.validators.js";

export interface FirewallCommandExecutor {
  run(request: CommandRequest): Promise<CommandResult>;
}

export type FirewallApplyResult = {
  applied: Array<{
    policyId: string;
    args: readonly string[];
    durationMs: number;
  }>;
  rolledBack: Array<{
    policyId: string;
    args: readonly string[];
    durationMs: number;
  }>;
};

export type FirewallStatusResult = {
  stdout: string;
  stderr: string;
  durationMs: number;
};

type RenderedFirewallCommand = {
  applyArgs: string[];
  rollbackArgs: string[];
};

export class UfwFirewallAdapter {
  constructor(private readonly commandExecutor: FirewallCommandExecutor = createDefaultFirewallCommandRunner()) {}

  async status(): Promise<FirewallStatusResult> {
    const result = await this.commandExecutor.run({
      policyId: "ufw:status",
      args: ["status", "verbose"],
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
    };
  }

  async applyRule(rule: FirewallRule): Promise<FirewallApplyResult> {
    const commands = renderUfwCommands(validateFirewallRule(rule));
    const appliedCommands: RenderedFirewallCommand[] = [];
    const applied: FirewallApplyResult["applied"] = [];

    try {
      for (const command of commands) {
        const result = await this.commandExecutor.run({
          policyId: "ufw:apply",
          args: command.applyArgs,
        });
        appliedCommands.push(command);
        applied.push(toAppliedCommand(result));
      }

      return {
        applied,
        rolledBack: [],
      };
    } catch (error) {
      const rolledBack = await this.rollback(appliedCommands);

      if (error instanceof AppError) {
        throw new AppError({
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          details: {
            ...(typeof error.details === "object" && error.details !== null ? error.details : {}),
            rolledBack,
          },
        });
      }

      throw error;
    }
  }

  private async rollback(commands: RenderedFirewallCommand[]): Promise<FirewallApplyResult["rolledBack"]> {
    const rolledBack: FirewallApplyResult["rolledBack"] = [];

    for (const command of [...commands].reverse()) {
      const result = await this.commandExecutor.run({
        policyId: "ufw:delete",
        args: command.rollbackArgs,
      });
      rolledBack.push(toAppliedCommand(result));
    }

    return rolledBack;
  }
}

export function renderUfwCommands(rule: FirewallRule): RenderedFirewallCommand[] {
  if (rule.targets.some((target) => target.kind === "country")) {
    throwUnsupported("Geo block requires an ipset/geo adapter and is not supported by UFW renderer");
  }

  if (rule.protocol === "icmp") {
    throwUnsupported("ICMP rules require an iptables/nftables adapter and are not supported by UFW renderer");
  }

  const action = actionToUfwAction(rule);
  const direction = rule.direction === "inbound" ? "in" : "out";
  const networkTargets = networkTargetsOrAny(rule.targets);
  const ports = portsFromRule(rule);
  const commands: RenderedFirewallCommand[] = [];

  for (const source of networkTargets) {
    for (const port of ports) {
      const applyArgs = [action, direction, "from", source, "to", "any"];

      if (port !== null) {
        applyArgs.push("port", port);
      }

      if (rule.protocol !== "all") {
        applyArgs.push("proto", rule.protocol);
      }

      commands.push({
        applyArgs,
        rollbackArgs: ["delete", ...applyArgs],
      });
    }
  }

  return commands;
}

export function createDefaultFirewallCommandRunner(): CommandRunner {
  return new CommandRunner(createFirewallCommandPolicies());
}

export function createFirewallCommandPolicies(): CommandPolicy[] {
  const argPattern = /^[A-Za-z0-9._:/=@,+%-]+$/;

  return [
    {
      id: "ufw:status",
      binary: env.UFW_BINARY,
      allowedSubcommands: ["status"],
      argPattern,
      timeoutMs: 15_000,
      maxArgs: 2,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "ufw:apply",
      binary: env.UFW_BINARY,
      allowedSubcommands: ["allow", "deny", "limit"],
      argPattern,
      timeoutMs: 30_000,
      maxArgs: 12,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "ufw:delete",
      binary: env.UFW_BINARY,
      allowedSubcommands: ["delete"],
      argPattern,
      timeoutMs: 30_000,
      maxArgs: 13,
      maxOutputBytes: 256 * 1024,
    },
  ];
}

function actionToUfwAction(rule: FirewallRule): "allow" | "deny" | "limit" {
  if (rule.type === "rate_limit") {
    return "limit";
  }

  if (rule.action === "allow" || rule.action === "deny" || rule.action === "limit") {
    return rule.action;
  }

  throwUnsupported("Log-only rules require an audit adapter and are not supported by UFW renderer");
}

function networkTargetsOrAny(targets: FirewallTarget[]): string[] {
  const values = targets
    .filter((target): target is Extract<FirewallTarget, { kind: "ip" | "cidr" }> =>
      target.kind === "ip" || target.kind === "cidr",
    )
    .map((target) => target.value);

  return values.length > 0 ? values : ["any"];
}

function portsFromRule(rule: FirewallRule): Array<string | null> {
  const ports = [
    ...rule.ports.map((port) => (typeof port === "number" ? String(port) : `${port.from}:${port.to}`)),
    ...rule.targets.flatMap((target) => {
      if (target.kind === "port") {
        return String(target.value);
      }

      if (target.kind === "port_range") {
        return `${target.from}:${target.to}`;
      }

      return [];
    }),
  ];

  return ports.length > 0 ? [...new Set(ports)] : [null];
}

function toAppliedCommand(result: CommandResult): { policyId: string; args: readonly string[]; durationMs: number } {
  return {
    policyId: result.policyId,
    args: result.args,
    durationMs: result.durationMs,
  };
}

function throwUnsupported(message: string): never {
  throw new AppError({
    code: "UNSUPPORTED_FIREWALL_RULE",
    message,
    statusCode: 400,
  });
}
