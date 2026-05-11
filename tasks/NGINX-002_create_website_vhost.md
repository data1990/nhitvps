# NGINX-002: Create Website/Vhost

## Metadata

- ID: NGINX-002
- Tên: Create website/vhost
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: NGINX-001, SEC-001

## Mô tả

Tạo service và API ghi virtual host từ template đã validate. Nếu file config đã tồn tại, backup trước khi ghi.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| NGINX-002.1 | Config paths | Thêm cấu hình sites-available/sites-enabled/backup dirs | NGINX-001 | P1 | DONE |
| NGINX-002.2 | Vhost writer | Ghi config atomically và backup file cũ | NGINX-001 | P1 | DONE |
| NGINX-002.3 | Routes | `/nginx/sites` protected by `nginx:update` | AUTH-003 | P1 | DONE |
| NGINX-002.4 | Tests | Test create/backup/validation/RBAC | NGINX-002.3 | P1 | DONE |

## Acceptance Criteria

- Config được render từ model đã validate.
- File cũ được backup trước khi overwrite.
- API thiếu quyền trả `FORBIDDEN`.
- Không reload nginx trong task này.

## Result

- Thêm `NginxConfigService` ghi vhost atomically.
- Backup config cũ trước khi overwrite.
- Copy config sang sites-enabled.
- Thêm API `POST /api/v1/nginx/sites` protected by `nginx:update`.
- `npm.cmd test`: pass, 42 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
