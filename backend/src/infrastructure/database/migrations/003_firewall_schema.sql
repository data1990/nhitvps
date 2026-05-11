-- NhiTVPS FW-001
-- Firewall rule and security event metadata schema.
-- Actual rule application is handled by FW-002 adapters.

CREATE TABLE IF NOT EXISTS firewall_rules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  type ENUM('blacklist', 'whitelist', 'rate_limit', 'geo_block', 'ssh_protection', 'ddos_protection', 'botnet_block') NOT NULL,
  action ENUM('allow', 'deny', 'limit', 'log') NOT NULL,
  direction ENUM('inbound', 'outbound') NOT NULL DEFAULT 'inbound',
  protocol ENUM('tcp', 'udp', 'icmp', 'all') NOT NULL DEFAULT 'tcp',
  targets_json JSON NOT NULL,
  ports_json JSON NOT NULL,
  rate_limit_json JSON NULL,
  priority INT UNSIGNED NOT NULL DEFAULT 1000,
  status ENUM('enabled', 'disabled', 'pending_apply', 'failed') NOT NULL DEFAULT 'disabled',
  description VARCHAR(500) NULL,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uq_firewall_rules_name (name),
  KEY idx_firewall_rules_type (type),
  KEY idx_firewall_rules_action (action),
  KEY idx_firewall_rules_status_priority (status, priority),
  KEY idx_firewall_rules_created_by_user_id (created_by_user_id),
  KEY idx_firewall_rules_deleted_at (deleted_at),
  CONSTRAINT fk_firewall_rules_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  type ENUM('brute_force', 'ddos_detected', 'firewall_block', 'geo_block', 'rate_limited', 'ssh_login_failed') NOT NULL,
  severity ENUM('info', 'low', 'medium', 'high', 'critical') NOT NULL,
  source_ip VARBINARY(16) NOT NULL,
  country_code CHAR(2) NULL,
  rule_id CHAR(36) NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_security_events_type (type),
  KEY idx_security_events_severity (severity),
  KEY idx_security_events_source_ip (source_ip),
  KEY idx_security_events_rule_id (rule_id),
  KEY idx_security_events_created_at (created_at),
  CONSTRAINT fk_security_events_rule
    FOREIGN KEY (rule_id) REFERENCES firewall_rules (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
