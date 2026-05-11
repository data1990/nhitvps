# NhiTVPS Architecture

## 1. Mục tiêu

NhiTVPS là một VPS control panel mini tương tự aaPanel/CyberPanel/Plesk, tập trung vào quản lý website, Nginx, MySQL/MariaDB, file, firewall/security, monitoring và user/role.

Hệ thống phải an toàn theo mặc định vì backend sẽ có khả năng gọi lệnh hệ điều hành, đọc/ghi file, reload service và quản lý database.

## 2. Kiến trúc tổng quan

```text
Browser
  |
  | HTTPS + WebSocket
  v
Frontend React/Vue + TailwindCSS
  |
  | REST API / WebSocket
  v
Backend Node.js Fastify
  |
  +-- Auth & RBAC
  +-- Audit Log
  +-- Nginx Manager
  +-- MySQL Manager
  +-- File Manager
  +-- Firewall & Security
  +-- Monitoring
  +-- Backup & Rollback
  |
  +-- MariaDB/MySQL
  +-- Redis
  +-- OS adapters: systemctl, nginx, certbot, ufw/iptables, fail2ban, docker
```

## 3. Backend Architecture

Backend dùng clean architecture theo 4 lớp:

1. `routes/controllers`: nhận request, validate input, trả response.
2. `application/services`: xử lý use case, kiểm tra permission, ghi audit log.
3. `domain`: entity, value object, rule nghiệp vụ.
4. `infrastructure/adapters`: gọi OS command, database, Redis, filesystem, Docker.

Nguyên tắc:

- Không gọi shell trực tiếp trong controller.
- Mọi command phải đi qua command runner có allowlist, timeout, argument escaping và audit.
- Mọi path filesystem phải normalize, resolve và kiểm tra nằm trong allowed roots.
- Mọi SQL dùng parameterized query/query builder.
- Mọi API có input schema validation.
- Mọi thao tác nhạy cảm ghi audit log.

## 4. Frontend Architecture

Frontend dùng React hoặc Vue với TailwindCSS.

Các khu vực chính:

- Dashboard monitoring.
- Websites/Nginx.
- Database.
- File Manager.
- Firewall/Security.
- Users/Roles/Sessions/2FA.
- Logs/Audit.
- Backup/Restore.

Frontend không tự tin tưởng dữ liệu người dùng nhập. Backend vẫn là nơi validate cuối cùng.

## 5. Data Architecture

MariaDB/MySQL lưu dữ liệu bền vững:

- users
- roles
- permissions
- sessions
- audit_logs
- websites
- databases
- backups
- firewall_rules
- system_events

Redis dùng cho:

- session/cache nếu cần
- websocket presence
- job queue/rate limit state
- temporary lock khi chạy task hệ thống

## 6. Realtime Architecture

WebSocket dùng cho:

- log streaming
- progress task
- monitoring realtime
- terminal-like command output nếu về sau cho phép

Không gửi secret qua WebSocket. Mọi channel phải kiểm tra session và permission.

## 7. Deployment Architecture

Mục tiêu chạy trên Ubuntu/Debian.

Thành phần:

- Backend Node.js service chạy sau Nginx reverse proxy.
- Frontend static build.
- MariaDB/MySQL.
- Redis optional.
- Docker compose cho development và deployment nhỏ.
- CI/CD chạy lint, test, build, security scan.

## 8. Dependency ban đầu

Backend:

- Node.js LTS
- Fastify
- Zod
- Pino
- Helmet
- CORS
- Rate limit
- Vitest

System:

- nginx
- certbot
- mysql/mariadb-client
- ufw hoặc iptables/nftables
- fail2ban
- unzip/zip
- docker CLI optional

## 9. Thứ tự ưu tiên

1. Core backend: config, logging, error handling, health API, security middleware.
2. Authentication: users, sessions, password hashing, 2FA base.
3. File Manager: path sandbox, file CRUD, upload/download, zip/unzip.
4. Nginx Manager: website/vhost/reverse proxy/reload/logs.
5. MySQL Manager: database/user/backup/restore/slow query.
6. Firewall/Security: rate limit, blacklist/whitelist, fail2ban, SSH protection.
7. Monitoring: CPU/RAM/Disk/Network/process/Docker.
8. Frontend optimization and UX polish.

