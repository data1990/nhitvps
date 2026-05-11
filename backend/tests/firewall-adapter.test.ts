import { describe, expect, it } from "vitest";
import type { CommandRequest, CommandResult } from "../src/infrastructure/command/index.js";
import { renderUfwCommands, UfwFirewallAdapter, type FirewallCommandExecutor } from "../src/modules/firewall/index.js";
import type { FirewallRule } from "../src/modules/firewall/index.js";
import { AppError } from "../src/shared/errors/app-error.js";

describe("ufw firewall adapter", () => {
  it("renders validated firewall rules into UFW argument arrays", () => {
    const commands = renderUfwCommands(createRule());

    expect(commands.map((command) => command.applyArgs)).toEqual([
      ["deny", "in", "from", "203.0.113.0/24", "to", "any", "port", "22", "proto", "tcp"],
      ["deny", "in", "from", "203.0.113.0/24", "to", "any", "port", "80:443", "proto", "tcp"],
    ]);
    expect(commands[0]?.rollbackArgs).toEqual([
      "delete",
      "deny",
      "in",
      "from",
      "203.0.113.0/24",
      "to",
      "any",
      "port",
      "22",
      "proto",
      "tcp",
    ]);
  });

  it("rolls back already applied commands when a later apply fails", async () => {
    const executor = new RecordingFirewallExecutor({
      failOnCall: 2,
    });
    const adapter = new UfwFirewallAdapter(executor);

    await expect(adapter.applyRule(createRule())).rejects.toThrowError("Command exited with a non-zero code");

    expect(executor.requests.map((request) => ({ policyId: request.policyId, args: request.args }))).toEqual([
      {
        policyId: "ufw:apply",
        args: ["deny", "in", "from", "203.0.113.0/24", "to", "any", "port", "22", "proto", "tcp"],
      },
      {
        policyId: "ufw:apply",
        args: ["deny", "in", "from", "203.0.113.0/24", "to", "any", "port", "80:443", "proto", "tcp"],
      },
      {
        policyId: "ufw:delete",
        args: ["delete", "deny", "in", "from", "203.0.113.0/24", "to", "any", "port", "22", "proto", "tcp"],
      },
    ]);
  });

  it("rejects unsupported geo block rules instead of rendering unsafe commands", async () => {
    const adapter = new UfwFirewallAdapter(new RecordingFirewallExecutor());

    await expect(
      adapter.applyRule({
        ...createRule(),
        type: "geo_block",
        action: "deny",
        targets: [{ kind: "country", value: "CN" }],
      }),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_FIREWALL_RULE",
    });
  });
});

class RecordingFirewallExecutor implements FirewallCommandExecutor {
  readonly requests: CommandRequest[] = [];

  constructor(private readonly options: { failOnCall?: number } = {}) {}

  async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(request);

    if (this.options.failOnCall === this.requests.length) {
      throw new AppError({
        code: "COMMAND_FAILED",
        message: "Command exited with a non-zero code",
        statusCode: 500,
      });
    }

    return {
      policyId: request.policyId,
      binary: "ufw",
      args: request.args ?? [],
      exitCode: 0,
      signal: null,
      stdout: "ok",
      stderr: "",
      durationMs: 1,
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
}

function createRule(): FirewallRule {
  return {
    id: "fw-1",
    name: "Block suspicious range",
    type: "blacklist",
    action: "deny",
    direction: "inbound",
    protocol: "tcp",
    targets: [{ kind: "cidr", value: "203.0.113.0/24" }],
    ports: [22, { from: 80, to: 443 }],
    priority: 100,
    status: "enabled",
  };
}
