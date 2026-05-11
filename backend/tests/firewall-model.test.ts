import { describe, expect, it } from "vitest";
import {
  assertCidr,
  assertCountryCode,
  assertIpAddress,
  validateFirewallRule,
  validateRateLimit,
  validateSecurityEvent,
} from "../src/modules/firewall/index.js";

describe("firewall rule model", () => {
  it("accepts blacklist and whitelist rules with IP/CIDR targets", () => {
    const blacklist = validateFirewallRule({
      id: "fw-1",
      name: "Block suspicious network",
      type: "blacklist",
      action: "deny",
      direction: "inbound",
      protocol: "tcp",
      targets: [{ kind: "cidr", value: "203.0.113.0/24" }],
      ports: [22, { from: 80, to: 443 }],
      priority: 100,
      status: "enabled",
    });

    expect(blacklist.targets[0]).toMatchObject({ kind: "cidr" });

    const whitelist = validateFirewallRule({
      ...blacklist,
      id: "fw-2",
      name: "Allow admin IP",
      type: "whitelist",
      action: "allow",
      targets: [{ kind: "ip", value: "198.51.100.10" }],
    });

    expect(whitelist.action).toBe("allow");
  });

  it("accepts rate limit and geo block models", () => {
    const rateLimit = validateFirewallRule({
      id: "fw-3",
      name: "Limit API traffic",
      type: "rate_limit",
      action: "limit",
      direction: "inbound",
      protocol: "tcp",
      targets: [{ kind: "cidr", value: "0.0.0.0/0" }],
      ports: [443],
      rateLimit: {
        requests: 120,
        windowSeconds: 60,
        burst: 40,
      },
      priority: 200,
      status: "enabled",
    });

    expect(rateLimit.rateLimit?.requests).toBe(120);

    const geoBlock = validateFirewallRule({
      ...rateLimit,
      id: "fw-4",
      name: "Block country",
      type: "geo_block",
      action: "deny",
      targets: [{ kind: "country", value: "RU" }],
      rateLimit: undefined,
    });

    expect(geoBlock.targets[0]).toMatchObject({ value: "RU" });
  });

  it("rejects unsafe values before adapter rendering", () => {
    expect(() => assertIpAddress("127.0.0.1; rm -rf /")).toThrowError("IP address contains unsafe characters");
    expect(() => assertCidr("203.0.113.999/24")).toThrowError("Invalid CIDR range");
    expect(() => assertCountryCode("vn")).toThrowError("country code must be ISO-3166 alpha-2 uppercase");
    expect(() =>
      validateFirewallRule({
        id: "fw-5",
        name: "Bad;Name",
        type: "blacklist",
        action: "deny",
        direction: "inbound",
        protocol: "tcp",
        targets: [{ kind: "ip", value: "198.51.100.1" }],
        ports: [22],
        priority: 100,
        status: "enabled",
      }),
    ).toThrowError("firewall rule name contains unsafe characters");
  });

  it("rejects invalid rule combinations", () => {
    expect(() =>
      validateFirewallRule({
        id: "fw-6",
        name: "Geo allow",
        type: "geo_block",
        action: "allow",
        direction: "inbound",
        protocol: "tcp",
        targets: [{ kind: "country", value: "CN" }],
        ports: [],
        priority: 100,
        status: "enabled",
      }),
    ).toThrowError("geo block rules must use deny action");

    expect(() => validateRateLimit({ requests: 0, windowSeconds: 60, burst: 0 })).toThrowError(
      "rate limit requests must be an integer between 1 and 1000000",
    );
  });

  it("validates security events", () => {
    const event = validateSecurityEvent({
      id: "event-1",
      type: "brute_force",
      severity: "high",
      sourceIp: "2001:db8::1",
      countryCode: "VN",
    });

    expect(event.sourceIp).toBe("2001:db8::1");

    expect(() =>
      validateSecurityEvent({
        ...event,
        sourceIp: "not-an-ip",
      }),
    ).toThrowError("Invalid IP address");
  });
});
