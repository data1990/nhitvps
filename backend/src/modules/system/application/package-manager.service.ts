import { env } from "../../../config/env.js";
import { CommandRunner, type CommandPolicy, type CommandRequest, type CommandResult } from "../../../infrastructure/command/index.js";

export type SystemComponent = "certbot" | "mariadb" | "mysql" | "nginx" | "ufw";

export interface SystemPackageCommandExecutor {
  run(request: CommandRequest): Promise<CommandResult>;
}

export type SystemPackageStatus = {
  component: SystemComponent;
  packages: Array<{
    name: string;
    installed: boolean;
    stdout: string;
    stderr: string;
  }>;
};

export type SystemPackageInstallResult = {
  component: SystemComponent;
  packages: string[];
  update: CommandSummary;
  install: CommandSummary;
  service: CommandSummary | null;
};

type CommandSummary = {
  policyId: string;
  args: readonly string[];
  stdout: string;
  stderr: string;
  durationMs: number;
};

const componentPackages: Record<SystemComponent, { packages: string[]; serviceName: string | null }> = {
  certbot: { packages: ["certbot", "python3-certbot-nginx"], serviceName: null },
  mariadb: { packages: ["mariadb-server"], serviceName: "mariadb" },
  mysql: { packages: ["mysql-server"], serviceName: "mysql" },
  nginx: { packages: ["nginx"], serviceName: "nginx" },
  ufw: { packages: ["ufw"], serviceName: "ufw" },
};

export class SystemPackageManagerService {
  public constructor(private readonly commandExecutor: SystemPackageCommandExecutor = createDefaultSystemPackageCommandRunner()) {}

  public async status(component: SystemComponent): Promise<SystemPackageStatus> {
    const definition = componentPackages[component];
    const packages = [];

    for (const packageName of definition.packages) {
      try {
        const result = await this.commandExecutor.run({
          policyId: "dpkg:status",
          args: ["-s", packageName],
        });
        packages.push({
          name: packageName,
          installed: true,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      } catch (error) {
        packages.push({
          name: packageName,
          installed: false,
          stdout: "",
          stderr: error instanceof Error ? error.message : "Package status check failed",
        });
      }
    }

    return {
      component,
      packages,
    };
  }

  public async install(component: SystemComponent, input: { startService?: boolean } = {}): Promise<SystemPackageInstallResult> {
    const definition = componentPackages[component];
    const update = await this.commandExecutor.run({
      policyId: "apt:update",
      args: ["update"],
    });
    const install = await this.commandExecutor.run({
      policyId: "apt:install",
      args: ["install", "-y", ...definition.packages],
    });
    const service =
      input.startService !== false && definition.serviceName
        ? await this.commandExecutor.run({
            policyId: "systemctl:service",
            args: ["enable", "--now", definition.serviceName],
          })
        : null;

    return {
      component,
      packages: definition.packages,
      update: summarizeCommand(update),
      install: summarizeCommand(install),
      service: service ? summarizeCommand(service) : null,
    };
  }

  public async installStack(components: readonly SystemComponent[]): Promise<SystemPackageInstallResult[]> {
    const results: SystemPackageInstallResult[] = [];

    for (const component of components) {
      results.push(await this.install(component));
    }

    return results;
  }
}

export function createDefaultSystemPackageCommandRunner(): CommandRunner {
  return new CommandRunner(createSystemPackageCommandPolicies());
}

export function createSystemPackageCommandPolicies(): CommandPolicy[] {
  const packageArgPattern = /^[A-Za-z0-9._:+-]+$/;

  return [
    {
      id: "apt:update",
      binary: env.APT_GET_BINARY,
      allowedSubcommands: ["update"],
      argPattern: /^update$/,
      timeoutMs: 120_000,
      maxArgs: 1,
      maxOutputBytes: 512 * 1024,
    },
    {
      id: "apt:install",
      binary: env.APT_GET_BINARY,
      allowedSubcommands: ["install"],
      argPattern: packageArgPattern,
      timeoutMs: 600_000,
      maxArgs: 8,
      maxOutputBytes: 1024 * 1024,
    },
    {
      id: "dpkg:status",
      binary: env.DPKG_BINARY,
      allowedSubcommands: ["-s"],
      argPattern: packageArgPattern,
      timeoutMs: 15_000,
      maxArgs: 2,
      maxOutputBytes: 256 * 1024,
    },
    {
      id: "systemctl:service",
      binary: env.SYSTEMCTL_BINARY,
      allowedSubcommands: ["enable", "start", "status"],
      argPattern: /^(?:enable|start|status|--now|nginx|mysql|mariadb|ufw)$/,
      timeoutMs: 60_000,
      maxArgs: 3,
      maxOutputBytes: 512 * 1024,
    },
  ];
}

function summarizeCommand(result: CommandResult): CommandSummary {
  return {
    policyId: result.policyId,
    args: result.args,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
  };
}
