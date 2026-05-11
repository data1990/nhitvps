import { AppError } from "../../../shared/errors/app-error.js";
import { assertDomain } from "../domain/nginx.validators.js";
import type { CommandExecutor, NginxRuntimeResult } from "./nginx-runtime.service.js";
import { createDefaultNginxCommandRunner, NginxRuntimeService } from "./nginx-runtime.service.js";

export type IssueLetsEncryptInput = {
  domain: string;
  aliases?: readonly string[];
  email: string;
  redirect?: boolean;
  staging?: boolean;
};

export type IssueLetsEncryptResult = {
  certbot: NginxRuntimeResult;
  reload: Awaited<ReturnType<NginxRuntimeService["reload"]>>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LetsEncryptService {
  private readonly runtimeService: NginxRuntimeService;

  public constructor(private readonly commandExecutor: CommandExecutor = createDefaultNginxCommandRunner()) {
    this.runtimeService = new NginxRuntimeService(commandExecutor);
  }

  public async issueCertificate(input: IssueLetsEncryptInput): Promise<IssueLetsEncryptResult> {
    validateInput(input);
    const args = createCertbotArgs(input);
    const certbotResult = await this.commandExecutor.run({
      policyId: "certbot:nginx",
      args,
    });
    const reload = await this.runtimeService.reload();

    return {
      certbot: {
        ok: true,
        command: "certbot",
        stdout: certbotResult.stdout,
        stderr: certbotResult.stderr,
        durationMs: certbotResult.durationMs,
      },
      reload,
    };
  }
}

export function createCertbotArgs(input: IssueLetsEncryptInput): string[] {
  return [
    "--nginx",
    "--non-interactive",
    "--agree-tos",
    "--email",
    input.email,
    ...(input.staging ? ["--staging"] : []),
    ...(input.redirect ? ["--redirect"] : []),
    "-d",
    input.domain,
    ...(input.aliases ?? []).flatMap((alias) => ["-d", alias]),
  ];
}

function validateInput(input: IssueLetsEncryptInput): void {
  if (!EMAIL_PATTERN.test(input.email) || /[\r\n\0;]/.test(input.email)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid Let's Encrypt email",
      statusCode: 400,
    });
  }

  assertDomain(input.domain);

  if (input.domain.includes("*")) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Wildcard certificates are not supported by this flow",
      statusCode: 400,
    });
  }

  for (const alias of input.aliases ?? []) {
    assertDomain(alias);

    if (alias.includes("*")) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Wildcard certificates are not supported by this flow",
        statusCode: 400,
      });
    }
  }
}

