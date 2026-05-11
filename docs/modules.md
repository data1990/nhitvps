# NhiTVPS Modules

## 1. Core Backend

Trách nhiệm:

- Load config từ env.
- Khởi tạo HTTP server.
- Logging có cấu trúc.
- Error handler chuẩn.
- Security headers, CORS, rate limit.
- Health/readiness endpoint.
- Plugin/module registry.

## 2. Authentication & User Management

Trách nhiệm:

- Đăng nhập/đăng xuất.
- Session management.
- Multi-user.
- RBAC permission.
- 2FA TOTP.
- Password policy.
- Audit security events.

## 3. File Manager

Trách nhiệm:

- Browse file/folder.
- Upload/download.
- Edit trực tiếp.
- Syntax highlight do frontend xử lý.
- chmod/chown qua adapter an toàn.
- Zip/unzip.
- Drag and drop.

Giới hạn an toàn:

- Chỉ cho phép thao tác trong allowed roots.
- Chặn path traversal.
- Chặn ghi vào system paths khi user không có permission.
- Giới hạn kích thước upload và file edit.

## 4. Nginx Manager

Trách nhiệm:

- Tạo website.
- Quản lý virtual host.
- Reverse proxy.
- SSL Let's Encrypt.
- Reload/restart nginx.
- Đọc access/error log.

Giới hạn an toàn:

- Sinh config từ template, không nối chuỗi tùy tiện.
- Validate domain/server_name/upstream.
- Test `nginx -t` trước reload.
- Backup config trước khi thay đổi.

## 5. MySQL/MariaDB Manager

Trách nhiệm:

- Tạo database.
- Tạo user.
- Grant permission.
- Backup/restore.
- Theo dõi slow query.

Giới hạn an toàn:

- Dùng parameterized query.
- Không log password.
- Backup có checksum.
- Restore cần xác nhận quyền và kiểm tra file.

## 6. Firewall & Security

Trách nhiệm:

- IP blacklist/whitelist.
- Rate limit.
- Geo block.
- SSH protection.
- Fail2Ban integration.
- Theo dõi brute force.
- DDOS/botnet mitigation cơ bản.

Giới hạn an toàn:

- Rule thay đổi phải atomic nếu có thể.
- Có rollback khi rule làm mất kết nối.
- Audit mọi thay đổi.

## 7. System Monitoring

Trách nhiệm:

- CPU/RAM/Disk/Network.
- Process monitor.
- Docker monitor nếu có.
- Realtime WebSocket.
- Alert rule về sau.

## 8. Backup & Rollback

Trách nhiệm:

- Backup database.
- Backup website files.
- Backup Nginx config.
- Restore có kiểm tra checksum.
- Retention policy.

## 9. API Documentation

Trách nhiệm:

- OpenAPI spec.
- Mô tả auth, error format, pagination.
- Document permission theo endpoint.

