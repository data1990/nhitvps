import { spawn } from "node:child_process";
import { AppError } from "../../shared/errors/app-error.js";

export type CommandPolicy = {
  id: string;
  binary: string;
  allowedSubcommands?: readonly string[];
  argPattern?: RegExp;
  cwd?: string;
  maxArgs?: number;
  maxOutputBytes?: number;
  timeoutMs: number;
};

export type CommandRequest = {
  policyId: string;
  args?: readonly string[];
  stdin?: string;
};

export type CommandResult = {
  policyId: string;
  binary: string;
  args: readonly string[];
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

export type CommandAuditEvent = {
  event: "blocked" | "started" | "succeeded" | "failed" | "timeout";
  policyId: string;
  binary?: string;
  args?: readonly string[];
  exitCode?: number;
  signal?: NodeJS.Signals | null;
  durationMs?: number;
  reason?: string;
};

export type CommandAuditHook = (event: CommandAuditEvent) => void | Promise<void>;

const DEFAULT_ARG_PATTERN = /^[A-Za-z0-9._:/=@,+%-]+$/;

export class CommandRunner {
  private readonly policies: Map<string, CommandPolicy>;
  private readonly auditHook?: CommandAuditHook;

  public constructor(policies: readonly CommandPolicy[], auditHook?: CommandAuditHook) {
    this.policies = new Map(policies.map((policy) => [policy.id, policy]));
    this.auditHook = auditHook;
  }

  public async run(request: CommandRequest): Promise<CommandResult> {
    const startedAt = Date.now();
    const policy = this.policies.get(request.policyId);

    if (!policy) {
      await this.audit({
        event: "blocked",
        policyId: request.policyId,
        reason: "Unknown command policy",
      });

      throw new AppError({
        code: "COMMAND_BLOCKED",
        message: "Command policy is not allowed",
        statusCode: 403,
      });
    }

    const args = [...(request.args ?? [])];
    const validationError = validateCommandArgs(policy, args);

    if (validationError) {
      await this.audit({
        event: "blocked",
        policyId: policy.id,
        binary: policy.binary,
        args,
        reason: validationError,
      });

      throw new AppError({
        code: "COMMAND_BLOCKED",
        message: validationError,
        statusCode: 400,
      });
    }

    await this.audit({
      event: "started",
      policyId: policy.id,
      binary: policy.binary,
      args,
    });

    return await new Promise<CommandResult>((resolve, reject) => {
      const maxOutputBytes = policy.maxOutputBytes ?? 1024 * 1024;
      const stdout = createOutputCollector(maxOutputBytes);
      const stderr = createOutputCollector(maxOutputBytes);
      let settled = false;
      let timedOut = false;

      const child = spawn(policy.binary, args, {
        cwd: policy.cwd,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, policy.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdout.append(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.append(chunk));

      child.on("error", (error) => {
        clearTimeout(timeout);

        if (settled) {
          return;
        }

        settled = true;
        const durationMs = Date.now() - startedAt;

        void this.audit({
          event: "failed",
          policyId: policy.id,
          binary: policy.binary,
          args,
          durationMs,
          reason: error.message,
        });

        reject(
          new AppError({
            code: "COMMAND_FAILED",
            message: "Command failed to start",
            statusCode: 500,
            details: {
              policyId: policy.id,
            },
          }),
        );
      });

      child.on("close", (exitCode, signal) => {
        clearTimeout(timeout);

        if (settled) {
          return;
        }

        settled = true;
        const durationMs = Date.now() - startedAt;
        const result: CommandResult = {
          policyId: policy.id,
          binary: policy.binary,
          args,
          exitCode: exitCode ?? -1,
          signal,
          stdout: stdout.value(),
          stderr: stderr.value(),
          durationMs,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        };

        if (timedOut) {
          void this.audit({
            event: "timeout",
            policyId: policy.id,
            binary: policy.binary,
            args,
            signal,
            durationMs,
            reason: "Command timed out",
          });

          reject(
            new AppError({
              code: "COMMAND_TIMEOUT",
              message: "Command timed out",
              statusCode: 504,
              details: {
                policyId: policy.id,
                durationMs,
              },
            }),
          );
          return;
        }

        if (result.exitCode !== 0) {
          void this.audit({
            event: "failed",
            policyId: policy.id,
            binary: policy.binary,
            args,
            exitCode: result.exitCode,
            signal,
            durationMs,
          });

          reject(
            new AppError({
              code: "COMMAND_FAILED",
              message: "Command exited with a non-zero code",
              statusCode: 500,
              details: {
                policyId: policy.id,
                exitCode: result.exitCode,
              },
            }),
          );
          return;
        }

        void this.audit({
          event: "succeeded",
          policyId: policy.id,
          binary: policy.binary,
          args,
          exitCode: result.exitCode,
          signal,
          durationMs,
        });

        resolve(result);
      });

      if (request.stdin !== undefined) {
        child.stdin.end(request.stdin);
      } else {
        child.stdin.end();
      }
    });
  }

  private async audit(event: CommandAuditEvent): Promise<void> {
    await this.auditHook?.(event);
  }
}

export function validateCommandArgs(policy: CommandPolicy, args: readonly string[]): string | null {
  if (args.length > (policy.maxArgs ?? 32)) {
    return "Command has too many arguments";
  }

  if (policy.allowedSubcommands && args[0] && !policy.allowedSubcommands.includes(args[0])) {
    return "Command subcommand is not allowed";
  }

  const argPattern = policy.argPattern ?? DEFAULT_ARG_PATTERN;

  for (const arg of args) {
    if (!arg) {
      return "Command argument cannot be empty";
    }

    if (/[\u0000-\u001f\u007f]/.test(arg)) {
      return "Command argument contains control characters";
    }

    if (/[;&|><`$\\]/.test(arg)) {
      return "Command argument contains blocked shell metacharacters";
    }

    if (!argPattern.test(arg)) {
      return "Command argument does not match policy";
    }
  }

  return null;
}

function createOutputCollector(maxBytes: number): {
  append: (chunk: Buffer) => void;
  value: () => string;
  truncated: boolean;
} {
  const chunks: Buffer[] = [];
  let currentBytes = 0;

  return {
    get truncated() {
      return currentBytes >= maxBytes;
    },
    append(chunk: Buffer) {
      if (currentBytes >= maxBytes) {
        return;
      }

      const remaining = maxBytes - currentBytes;
      const nextChunk = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      chunks.push(nextChunk);
      currentBytes += nextChunk.byteLength;
    },
    value() {
      return Buffer.concat(chunks).toString("utf8");
    },
  };
}

