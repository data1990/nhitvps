export type FirewallRuleType =
  | "blacklist"
  | "whitelist"
  | "rate_limit"
  | "geo_block"
  | "ssh_protection"
  | "ddos_protection"
  | "botnet_block";

export type FirewallAction = "allow" | "deny" | "limit" | "log";

export type FirewallProtocol = "tcp" | "udp" | "icmp" | "all";

export type FirewallRuleStatus = "enabled" | "disabled" | "pending_apply" | "failed";

export type FirewallDirection = "inbound" | "outbound";

export type FirewallIpTarget = {
  kind: "ip";
  value: string;
};

export type FirewallCidrTarget = {
  kind: "cidr";
  value: string;
};

export type FirewallCountryTarget = {
  kind: "country";
  value: string;
};

export type FirewallPortTarget = {
  kind: "port";
  value: number;
};

export type FirewallPortRangeTarget = {
  kind: "port_range";
  from: number;
  to: number;
};

export type FirewallTarget =
  | FirewallIpTarget
  | FirewallCidrTarget
  | FirewallCountryTarget
  | FirewallPortTarget
  | FirewallPortRangeTarget;

export type FirewallRateLimit = {
  requests: number;
  windowSeconds: number;
  burst: number;
};

export type FirewallRule = {
  id: string;
  name: string;
  type: FirewallRuleType;
  action: FirewallAction;
  direction: FirewallDirection;
  protocol: FirewallProtocol;
  targets: FirewallTarget[];
  ports: Array<number | { from: number; to: number }>;
  rateLimit?: FirewallRateLimit;
  priority: number;
  status: FirewallRuleStatus;
  description?: string;
  createdByUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SecurityEventSeverity = "info" | "low" | "medium" | "high" | "critical";

export type SecurityEventType =
  | "brute_force"
  | "ddos_detected"
  | "firewall_block"
  | "geo_block"
  | "rate_limited"
  | "ssh_login_failed";

export type SecurityEvent = {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  sourceIp: string;
  countryCode?: string | null;
  ruleId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt?: Date;
};
