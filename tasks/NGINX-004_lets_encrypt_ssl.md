# NGINX-004: Let's Encrypt SSL

## Metadata

- ID: NGINX-004
- Tên: Let's Encrypt SSL
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: NGINX-002

## Mô tả

Tích hợp Certbot để cấp SSL Let's Encrypt cho domain đã validate. Sau khi cấp SSL thành công, reload Nginx thông qua runtime service.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| NGINX-004.1 | Certbot policy | Tạo command policy allowlist cho certbot nginx installer | SEC-001 | P1 | DONE |
| NGINX-004.2 | SSL service | Validate domain/email và gọi certbot | NGINX-001 | P1 | DONE |
| NGINX-004.3 | Reload after issue | Reload Nginx sau khi certbot thành công | NGINX-003 | P1 | DONE |
| NGINX-004.4 | Route | `/nginx/ssl/lets-encrypt` protected by `nginx:update` | AUTH-003 | P1 | DONE |
| NGINX-004.5 | Tests | Test validation, command order, RBAC | NGINX-004.4 | P1 | DONE |

## Acceptance Criteria

- Certbot command đi qua CommandRunner.
- Validate email và domain trước khi chạy certbot.
- Không hỗ trợ wildcard trong task này.
- Reload Nginx sau khi cấp SSL thành công.
- Test pass.

## Result

- Implemented `LetsEncryptService` with email/domain validation and wildcard rejection.
- Added `certbot:nginx` CommandRunner policy with fixed binary, allowlisted subcommand, argument validation, timeout, and output cap.
- Added protected API `POST /api/v1/nginx/ssl/lets-encrypt` requiring `nginx:update`.
- Added unit/integration tests for argument creation, command order, validation, RBAC success, and RBAC forbidden.
- Verification:
  - `npm.cmd test`: PASS, 50 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
