import { describe, expect, it } from "vitest";
import { CommandRunner, validateCommandArgs, type CommandAuditEvent } from "../src/infrastructure/command/index.js";
import { AppError } from "../src/shared/errors/app-error.js";

describe("CommandRunner", () => {
  it("runs an allowed command without shell", async () => {
    const auditEvents: CommandAuditEvent[] = [];
    const runner = new CommandRunner(
      [
        {
          id: "node-version",
          binary: process.execPath,
          allowedSubcommands: ["--version"],
          timeoutMs: 5000,
        },
      ],
      (event) => auditEvents.push(event),
    );

    const result = await runner.run({
      policyId: "node-version",
      args: ["--version"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^v\d+\./);
    expect(auditEvents.map((event) => event.event)).toEqual(["started", "succeeded"]);
  });

  it("blocks unknown policies", async () => {
    const runner = new CommandRunner([]);

    await expect(
      runner.run({
        policyId: "missing",
      }),
    ).rejects.toMatchObject({
      code: "COMMAND_BLOCKED",
      statusCode: 403,
    } satisfies Partial<AppError>);
  });

  it("blocks suspicious arguments", () => {
    const policy = {
      id: "safe",
      binary: process.execPath,
      timeoutMs: 5000,
    };

    expect(validateCommandArgs(policy, ["--version;rm"])).toBe("Command argument contains blocked shell metacharacters");
  });

  it("times out slow commands", async () => {
    const runner = new CommandRunner([
      {
        id: "slow-node",
        binary: process.execPath,
        allowedSubcommands: ["-e"],
        argPattern: /^[A-Za-z0-9._:/=@,+%(){}"' -]+$/,
        timeoutMs: 50,
      },
    ]);

    await expect(
      runner.run({
        policyId: "slow-node",
        args: ["-e", "setTimeout(function(){},5000)"],
      }),
    ).rejects.toMatchObject({
      code: "COMMAND_TIMEOUT",
      statusCode: 504,
    } satisfies Partial<AppError>);
  });
});
