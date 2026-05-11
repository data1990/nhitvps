# NhiTVPS Security Model

## 1. Threat Model

NhiTVPS là phần mềm quản trị VPS nên rủi ro chính gồm:

- Command injection khi gọi shell.
- Path traversal trong File Manager.
- SQL injection trong MySQL Manager.
- Privilege escalation qua RBAC sai.
- CSRF/XSS trên dashboard.
- Session hijacking.
- Brute force đăng nhập.
- SSRF qua reverse proxy/upstream.
- RCE do unzip, edit file hoặc plugin tương lai.
- Lộ secret trong log/backup.
- Lockout VPS do firewall rule sai.

## 2. Nguyên tắc bảo mật

- Deny by default.
- Least privilege.
- Validate input ở mọi boundary.
- Escape/sanitize output ở frontend.
- Không gọi shell từ input thô.
- Không log secret.
- Backup trước thay đổi destructive.
- Audit mọi hành động nhạy cảm.

## 3. Command Security

Mọi OS command phải qua command runner:

- Allowlist binary và subcommand.
- Truyền argument dạng array, không nối string shell.
- Timeout bắt buộc.
- Working directory cố định.
- Không cho phép shell metacharacter.
- Capture stdout/stderr có giới hạn size.
- Audit command class, actor, target, result.

## 4. Filesystem Security

- Dùng `path.resolve`.
- So sánh path resolved với allowed roots.
- Chặn symlink escape.
- Giới hạn file size khi edit.
- Validate mime/extension khi upload nếu cần.
- Không cho download secret paths mặc định.

## 5. Web Security

- Helmet security headers.
- CORS allowlist.
- CSRF protection cho cookie session.
- HTTP-only secure same-site cookies.
- Rate limit login và API nhạy cảm.
- Zod schema validation.
- Chuẩn hóa error response, không leak stack trace production.

## 6. Database Security

- Parameterized query.
- User database riêng cho app với quyền tối thiểu.
- Migration kiểm soát schema.
- Password hash bằng Argon2/bcrypt.
- Không log DSN/password/token.

## 7. Auth & Session

- Session rotation sau login.
- Expiry và revoke session.
- 2FA TOTP.
- Password policy.
- Lockout/rate limit theo IP và account.
- Audit login success/fail.

## 8. Firewall Safety

- Trước khi áp dụng rule có thể gây lockout, tạo rollback timer.
- Whitelist IP quản trị nếu cấu hình.
- Validate CIDR/IP.
- Ghi audit rule diff.

## 9. Security Priority

P0:

- Config/env validation.
- Input validation.
- Error handling không leak stack.
- Command runner policy.
- Path sandbox policy.

P1:

- Auth/session/RBAC.
- Audit log.
- CSRF.
- Rate limit nâng cao.

P2:

- Geo block.
- Fail2Ban analytics.
- Security dashboard.

