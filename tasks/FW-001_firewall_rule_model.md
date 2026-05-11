# FW-001: Firewall rule model

## Metadata

- ID: FW-001
- Tên: Firewall rule model
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: AUTH-003

## Mô tả

Thiết kế domain model và metadata schema cho firewall/security rules: blacklist, whitelist, rate limit, geo block, SSH protection và DDOS/botnet protection. Task này chưa apply rule vào UFW/iptables; adapter thực thi thuộc FW-002.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FW-001.1 | Domain types | Tạo type cho firewall rule, target, action, schedule, status | AUTH-003 | P2 | DONE |
| FW-001.2 | Validators | Validate IP/CIDR/port/protocol/country/rate limit an toàn | FW-001.1 | P2 | DONE |
| FW-001.3 | Migration | Tạo metadata schema cho firewall rules và security events | FW-001.1 | P2 | DONE |
| FW-001.4 | Tests | Test validator cho blacklist/whitelist/rate limit/geo block | FW-001.2 | P2 | DONE |

## Acceptance Criteria

- Có model đủ cho blacklist, whitelist, rate limit, geo block và SSH protection.
- Validate IP/CIDR, port range, protocol, ISO country code và rate limit.
- Chặn input chứa shell metacharacter hoặc target không hợp lệ trước FW-002.
- Metadata schema hỗ trợ audit/security event.
- Test pass.

## Result

- Added firewall domain model for blacklist, whitelist, rate limit, geo block, SSH protection, DDOS protection, and botnet block rules.
- Added validators for IP, CIDR, country code, port, port range, priority, safe names, rate limit, and security events.
- Added metadata migration `003_firewall_schema.sql` for firewall rules and security events.
- Added unit tests for valid rule models, unsafe values, invalid rule combinations, and security event validation.
- Verification:
  - `npm.cmd test`: PASS, 70 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
