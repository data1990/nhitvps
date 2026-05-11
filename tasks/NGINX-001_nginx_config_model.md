# NGINX-001: Nginx Config Model

## Metadata

- ID: NGINX-001
- Tên: Nginx config model
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: AUTH-003

## Mô tả

Thiết kế domain model và validator cho website/vhost/reverse proxy. Task này chưa ghi config thật vào `/etc/nginx`.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| NGINX-001.1 | Domain types | Website/vhost/reverse proxy/SSL model | AUTH-003 | P1 | DONE |
| NGINX-001.2 | Validators | Validate domain, root path, upstream | NGINX-001.1 | P1 | DONE |
| NGINX-001.3 | Template renderer | Render server block từ model an toàn | NGINX-001.2 | P1 | DONE |
| NGINX-001.4 | Tests | Test validation và render output | NGINX-001.3 | P1 | DONE |

## Acceptance Criteria

- Domain/server_name được validate.
- Upstream reverse proxy chỉ cho http/https và host hợp lệ.
- Không cho ký tự xuống dòng trong giá trị render.
- Template không nhận string thô chưa validate.

## Result

- Thêm Nginx site domain model.
- Thêm validator domain/path/upstream.
- Thêm vhost renderer cho static và reverse proxy.
- `npm.cmd test`: pass, 40 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
