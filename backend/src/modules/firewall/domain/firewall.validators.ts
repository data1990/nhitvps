import net from "node:net";
import { AppError } from "../../../shared/errors/app-error.js";
import type {
  FirewallRateLimit,
  FirewallRule,
  FirewallRuleType,
  FirewallTarget,
  SecurityEvent,
} from "./firewall.types.js";

const SAFE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const IPV4_CIDR_PATTERN = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
const IPV6_CIDR_PATTERN = /^[0-9A-Fa-f:.]+\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/;

export function validateFirewallRule(rule: FirewallRule): FirewallRule {
  assertSafeName(rule.name);
  assertPortList(rule.ports);
  assertTargetsForRuleType(rule.type, rule.targets);

  if (rule.priority < 1 || rule.priority > 10_000 || !Number.isInteger(rule.priority)) {
    throwValidation("firewall priority must be an integer between 1 and 10000");
  }

  if (rule.rateLimit !== undefined) {
    validateRateLimit(rule.rateLimit);
  }

  if (rule.type === "rate_limit" && rule.rateLimit === undefined) {
    throwValidation("rate limit rule requires rateLimit");
  }

  if (rule.type === "geo_block" && rule.action !== "deny") {
    throwValidation("geo block rules must use deny action");
  }

  if (rule.type === "whitelist" && rule.action !== "allow") {
    throwValidation("whitelist rules must use allow action");
  }

  if (rule.description !== undefined) {
    assertSafeDescription(rule.description);
  }

  return rule;
}

export function validateSecurityEvent(event: SecurityEvent): SecurityEvent {
  assertIpAddress(event.sourceIp);

  if (event.countryCode !== undefined && event.countryCode !== null) {
    assertCountryCode(event.countryCode);
  }

  return event;
}

export function assertFirewallTarget(target: FirewallTarget): void {
  switch (target.kind) {
    case "ip":
      assertIpAddress(target.value);
      return;
    case "cidr":
      assertCidr(target.value);
      return;
    case "country":
      assertCountryCode(target.value);
      return;
    case "port":
      assertPort(target.value);
      return;
    case "port_range":
      assertPortRange(target.from, target.to);
      return;
  }
}

export function validateRateLimit(rateLimit: FirewallRateLimit): FirewallRateLimit {
  if (!Number.isInteger(rateLimit.requests) || rateLimit.requests < 1 || rateLimit.requests > 1_000_000) {
    throwValidation("rate limit requests must be an integer between 1 and 1000000");
  }

  if (!Number.isInteger(rateLimit.windowSeconds) || rateLimit.windowSeconds < 1 || rateLimit.windowSeconds > 86_400) {
    throwValidation("rate limit windowSeconds must be an integer between 1 and 86400");
  }

  if (!Number.isInteger(rateLimit.burst) || rateLimit.burst < 0 || rateLimit.burst > 1_000_000) {
    throwValidation("rate limit burst must be an integer between 0 and 1000000");
  }

  return rateLimit;
}

export function assertIpAddress(value: string): void {
  assertSafeScalar("IP address", value);

  if (net.isIP(value) === 0) {
    throwValidation("Invalid IP address");
  }
}

export function assertCidr(value: string): void {
  assertSafeScalar("CIDR", value);

  if (IPV4_CIDR_PATTERN.test(value)) {
    const [address] = value.split("/");
    const octets = address?.split(".").map(Number) ?? [];

    if (octets.length === 4 && octets.every((octet) => octet >= 0 && octet <= 255)) {
      return;
    }
  }

  if (IPV6_CIDR_PATTERN.test(value)) {
    const [address] = value.split("/");

    if (address && net.isIP(address) === 6) {
      return;
    }
  }

  throwValidation("Invalid CIDR range");
}

export function assertCountryCode(value: string): void {
  assertSafeScalar("country code", value);

  if (!COUNTRY_CODE_PATTERN.test(value)) {
    throwValidation("country code must be ISO-3166 alpha-2 uppercase");
  }
}

export function assertPort(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throwValidation("port must be an integer between 1 and 65535");
  }
}

export function assertPortRange(from: number, to: number): void {
  assertPort(from);
  assertPort(to);

  if (from > to) {
    throwValidation("port range start must be lower than or equal to end");
  }
}

function assertTargetsForRuleType(type: FirewallRuleType, targets: FirewallTarget[]): void {
  if (targets.length === 0) {
    throwValidation("firewall rule requires at least one target");
  }

  for (const target of targets) {
    assertFirewallTarget(target);
  }

  if (type === "geo_block" && targets.some((target) => target.kind !== "country")) {
    throwValidation("geo block rules only accept country targets");
  }

  if (["blacklist", "whitelist", "botnet_block"].includes(type) && targets.some((target) => target.kind === "country")) {
    throwValidation(`${type} rules do not accept country targets`);
  }
}

function assertPortList(ports: FirewallRule["ports"]): void {
  for (const port of ports) {
    if (typeof port === "number") {
      assertPort(port);
    } else {
      assertPortRange(port.from, port.to);
    }
  }
}

function assertSafeName(value: string): void {
  if (!SAFE_NAME_PATTERN.test(value) || hasUnsafeScalarCharacters(value)) {
    throwValidation("firewall rule name contains unsafe characters");
  }
}

function assertSafeDescription(value: string): void {
  if (value.length > 500 || /[\0]/.test(value)) {
    throwValidation("firewall rule description contains unsafe characters");
  }
}

function assertSafeScalar(label: string, value: string): void {
  if (!value.trim() || hasUnsafeScalarCharacters(value)) {
    throwValidation(`${label} contains unsafe characters`);
  }
}

function hasUnsafeScalarCharacters(value: string): boolean {
  return /[\r\n\0;&|><`$\\]/.test(value);
}

function throwValidation(message: string): never {
  throw new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: 400,
  });
}
