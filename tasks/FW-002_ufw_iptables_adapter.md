# FW-002: UFW/iptables adapter

## Metadata

- ID: FW-002
- Tên: UFW/iptables adapter
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: FW-001, SEC-001

## Mô tả

Tạo adapter áp dụng firewall rule vào hệ thống qua CommandRunner allowlist. Bước đầu ưu tiên UFW cho IP/CIDR/port/rate limit; mọi lệnh phải đi qua argument array và có rollback khi apply một phần thất bại.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FW-002.1 | Command policies | Allowlist UFW status/apply/delete với argument pattern an toàn | SEC-001 | P2 | DONE |
| FW-002.2 | UFW renderer | Render FirewallRule thành args UFW đã validate | FW-001 | P2 | DONE |
| FW-002.3 | Rollback | Xóa các rule đã apply nếu command sau fail | FW-002.2 | P2 | DONE |
| FW-002.4 | Routes | API protected by `firewall:update` và `firewall:execute` | AUTH-003 | P2 | DONE |
| FW-002.5 | Tests | Test render, rollback, unsupported geo block, RBAC | FW-002.4 | P2 | DONE |

## Acceptance Criteria

- Không dùng shell.
- Không nối string command thủ công.
- Rule phải validate trước khi render.
- Nếu apply thất bại giữa chừng, rollback các command đã chạy.
- Unsupported geo block phải bị chặn rõ ràng thay vì apply sai.
- Test pass.

## Result

- Added UFW command policies for status/apply/delete through CommandRunner.
- Added UFW renderer that converts validated firewall rules into argument arrays.
- Added rollback: if a later apply command fails, previously applied commands are removed with `ufw delete`.
- Added firewall APIs:
  - `GET /api/v1/firewall/status` requiring `firewall:read`
  - `POST /api/v1/firewall/rules/apply` requiring `firewall:update`
- Unsupported geo block and ICMP rules are rejected clearly instead of being applied incorrectly.
- Verification:
  - `npm.cmd test`: PASS, 75 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
