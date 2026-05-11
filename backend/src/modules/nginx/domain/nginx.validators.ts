import path from "node:path";
import { AppError } from "../../../shared/errors/app-error.js";
import type { NginxSiteConfig } from "./nginx.types.js";

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

export function validateNginxSiteConfig(config: NginxSiteConfig): NginxSiteConfig {
  assertSafeValue("domain", config.domain);
  assertDomain(config.domain);

  for (const alias of config.aliases) {
    assertSafeValue("alias", alias);
    assertDomain(alias);
  }

  assertSafePath("accessLogPath", config.accessLogPath);
  assertSafePath("errorLogPath", config.errorLogPath);

  if (config.mode === "static") {
    if (!config.documentRoot) {
      throwValidation("documentRoot is required for static sites");
    }

    assertSafePath("documentRoot", config.documentRoot);
  }

  if (config.mode === "reverse_proxy") {
    if (!config.upstreamUrl) {
      throwValidation("upstreamUrl is required for reverse proxy sites");
    }

    assertUpstreamUrl(config.upstreamUrl);
  }

  return config;
}

export function assertDomain(value: string): void {
  if (!DOMAIN_PATTERN.test(value)) {
    throwValidation("Invalid domain");
  }
}

export function assertUpstreamUrl(value: string): void {
  assertSafeValue("upstreamUrl", value);

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throwValidation("Invalid upstream URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throwValidation("Upstream URL must use http or https");
  }

  if (!url.hostname || url.username || url.password || url.hash) {
    throwValidation("Invalid upstream URL");
  }
}

export function assertSafeValue(name: string, value: string): void {
  if (!value.trim() || /[\r\n\0;]/.test(value)) {
    throwValidation(`${name} contains unsafe characters`);
  }
}

export function assertSafePath(name: string, value: string): void {
  assertSafeValue(name, value);

  if (!path.isAbsolute(value)) {
    throwValidation(`${name} must be absolute`);
  }
}

function throwValidation(message: string): never {
  throw new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: 400,
  });
}

