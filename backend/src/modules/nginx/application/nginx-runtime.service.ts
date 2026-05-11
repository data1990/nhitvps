import { env } from "../../../config/env.js";
import { CommandRunner, type CommandPolicy, type CommandRequest, type CommandResult } from "../../../infrastructure/command/index.js";

export interface CommandExecutor {
  run(request: CommandRequest): Promise<CommandResult>;
}

export type NginxRuntimeResult = {
  ok: true;
  command: string;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export class NginxRuntimeService {
  public constructor(private readonly commandExecutor: CommandExecutor = createDefaultNginxCommandRunner()) {}

  public async testConfig(): Promise<NginxRuntimeResult> {
    return toRuntimeResult("test", await this.commandExecutor.run({ policyId: "nginx:test", args: ["-t"] }));
  }

  public async reload(): Promise<{ test: NginxRuntimeResult; reload: NginxRuntimeResult }> {
    const test = await this.testConfig();
    const reload = toRuntimeResult(
      "reload",
      await this.commandExecutor.run({ policyId: "nginx:reload", args: ["-s", "reload"] }),
    );

    return {
      test,
      reload,
    };
  }

  public async restart(): Promise<{ test: NginxRuntimeResult; restart: NginxRuntimeResult }> {
    const test = await this.testConfig();
    const restart = toRuntimeResult(
      "restart",
      await this.commandExecutor.run({ policyId: "nginx:restart", args: ["restart", "nginx"] }),
    );

    return {
      test,
      restart,
    };
  }
}

export function createDefaultNginxCommandRunner(): CommandRunner {
  return new CommandRunner(createNginxCommandPolicies());
}

export function createNginxCommandPolicies(): CommandPolicy[] {
  return [
    {
      id: "nginx:test",
      binary: env.NGINX_BINARY,
      allowedSubcommands: ["-t"],
      timeoutMs: 15_000,
      maxArgs: 1,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "nginx:reload",
      binary: env.NGINX_BINARY,
      allowedSubcommands: ["-s"],
      argPattern: /^(?:-s|reload)$/,
      timeoutMs: 15_000,
      maxArgs: 2,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "nginx:restart",
      binary: env.SYSTEMCTL_BINARY,
      allowedSubcommands: ["restart"],
      argPattern: /^(?:restart|nginx)$/,
      timeoutMs: 30_000,
      maxArgs: 2,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "certbot:nginx",
      binary: env.CERTBOT_BINARY,
      allowedSubcommands: ["--nginx"],
      argPattern: /^[A-Za-z0-9._:/=@,+%-]+$/,
      timeoutMs: 120_000,
      maxArgs: 32,
      maxOutputBytes: 512 * 1024,
    },
  ];
}

function toRuntimeResult(command: string, result: CommandResult): NginxRuntimeResult {
  return {
    ok: true,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
  };
}
