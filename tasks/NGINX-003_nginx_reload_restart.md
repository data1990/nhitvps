# NGINX-003: Nginx Reload/Restart

## Metadata

- ID: NGINX-003
- Tên: Nginx reload/restart
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: NGINX-002

## Mô tả

Tạo service và API kiểm tra cấu hình Nginx bằng `nginx -t`, sau đó reload/restart qua command runner policy. Không gọi shell trực tiếp.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| NGINX-003.1 | Runtime policies | Tạo command policies cho nginx/systemctl | SEC-001 | P1 | DONE |
| NGINX-003.2 | Runtime service | `testConfig`, `reload`, `restart` | NGINX-003.1 | P1 | DONE |
| NGINX-003.3 | Routes | `/nginx/test`, `/nginx/reload`, `/nginx/restart` protected by `nginx:execute` | AUTH-003 | P1 | DONE |
| NGINX-003.4 | Tests | Test command order, RBAC, failure path | NGINX-003.3 | P1 | DONE |

## Acceptance Criteria

- Reload/restart luôn chạy test config trước.
- Command đi qua allowlist policy.
- API thiếu quyền trả `FORBIDDEN`.
- Test pass.

## Result

- Thêm command policies cho `nginx -t`, `nginx -s reload`, `systemctl restart nginx`.
- Thêm `NginxRuntimeService`.
- Reload/restart luôn chạy test config trước.
- Thêm API `/api/v1/nginx/test`, `/api/v1/nginx/reload`, `/api/v1/nginx/restart`.
- `npm.cmd test`: pass, 45 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
