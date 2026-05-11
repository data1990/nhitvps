# NhiTVPS Backlog

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| BE-001 | Core backend scaffold | Tạo Fastify backend với config, logging, error handler, health API, security middleware | None | P0 | DONE |
| BE-002 | API error contract | Chuẩn hóa error response và request id | BE-001 | P0 | DONE |
| SEC-001 | Command runner policy | Tạo command runner allowlist, timeout, argument array, audit hook | BE-001 | P0 | DONE |
| SEC-002 | Path sandbox policy | Tạo utility validate path chống traversal/symlink escape | BE-001 | P0 | DONE |
| AUTH-001 | User model and migration | Thiết kế bảng users/roles/permissions/sessions | BE-001 | P0 | DONE |
| AUTH-002 | Login/session API | Đăng nhập, đăng xuất, session cookie, rate limit | AUTH-001 | P0 | DONE |
| AUTH-003 | RBAC middleware | Permission guard theo role/module/action | AUTH-001 | P0 | DONE |
| AUTH-004 | 2FA TOTP | Setup/verify/recovery codes | AUTH-002 | P1 | DONE |
| FILE-001 | File manager list/read | Browse và read file trong allowed roots | SEC-002, AUTH-003 | P1 | DONE |
| FILE-002 | File upload/download | Upload/download có size limit và audit | FILE-001 | P1 | DONE |
| FILE-003 | File edit/chmod/chown | Edit/chmod/chown qua policy an toàn | FILE-001, SEC-001 | P1 | DONE |
| FILE-004 | Zip/unzip | Zip/unzip có kiểm tra path và zip slip | FILE-001, SEC-001 | P1 | DONE |
| NGINX-001 | Nginx config model | Website/vhost/reverse proxy data model | AUTH-003 | P1 | DONE |
| NGINX-002 | Create website/vhost | Sinh virtual host từ template và backup config | NGINX-001, SEC-001 | P1 | DONE |
| NGINX-003 | Nginx reload/restart | `nginx -t` trước reload/restart, audit kết quả | NGINX-002 | P1 | DONE |
| NGINX-004 | Let's Encrypt SSL | Certbot integration an toàn | NGINX-002 | P1 | DONE |
| DB-001 | Database manager model | Quản lý database/user metadata | AUTH-003 | P1 | DONE |
| DB-002 | Create database/user | Tạo database/user bằng parameterized SQL | DB-001 | P1 | DONE |
| DB-003 | Backup/restore database | Backup/restore có checksum và audit | DB-002, SEC-001 | P1 | DONE |
| FW-001 | Firewall rule model | Model blacklist/whitelist/rate limit/geo block | AUTH-003 | P2 | DONE |
| FW-002 | UFW/iptables adapter | Áp dụng rule qua adapter có rollback | FW-001, SEC-001 | P2 | DONE |
| MON-001 | System metrics API | CPU/RAM/Disk/Network/process snapshot | BE-001 | P2 | DONE |
| MON-002 | WebSocket metrics stream | Stream realtime metrics/logs | MON-001 | P2 | DONE |
| DEPLOY-001 | Docker deployment | Dockerfile, compose, env mẫu | BE-001 | P2 | DONE |
| CI-001 | CI pipeline | Lint/test/build/security scan | BE-001 | P2 | DONE |
| DOC-001 | OpenAPI documentation | Sinh API documentation | BE-001 | P2 | DONE |
| FE-001 | Frontend scaffold | Tạo React + Tailwind dashboard shell | DOC-001 | P1 | DONE |
| FE-002 | Auth UI | Login/logout/session state và protected routes | FE-001, AUTH-002 | P1 | DONE |
| FE-003 | File manager UI | Browse/read/upload/download/edit/chmod/chown/zip/unzip | FE-002, FILE-004 | P1 | DONE |
| FE-004 | Monitoring UI | Dashboard CPU/RAM/Disk/Network và WebSocket stream | FE-002, MON-002 | P1 | DONE |
| FE-005 | Operations UI | Nginx/MySQL/Firewall screens | FE-002, NGINX-004, DB-003, FW-002 | P1 | DONE |
| OPS-001 | Auto backup scheduler | Lịch backup database/config và retention policy | DB-003, NGINX-002 | P1 | DONE |
| OPS-002 | Rollback manager | Rollback config/database backup có audit log | OPS-001 | P1 | DONE |
| HOST-001 | Host agent design | Tách agent quyền cao cho UFW/Nginx/Certbot/system commands | SEC-001, DEPLOY-001 | P0 | DONE |
| SYS-001 | System package installer | Install/check Nginx, MySQL/MariaDB, UFW va Certbot through guarded backend commands | SEC-001, AUTH-003 | P1 | DONE |
