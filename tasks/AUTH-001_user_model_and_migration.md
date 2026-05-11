# AUTH-001: User Model and Migration

## Metadata

- ID: AUTH-001
- Tên: User model and migration
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Thiết kế auth data model cho users, roles, permissions, sessions và 2FA base. Chưa implement login/session API ở task này.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AUTH-001.1 | Domain types | Tạo type user/role/permission/session | BE-001 | P0 | DONE |
| AUTH-001.2 | Permission key helper | Chuẩn hóa permission theo `module:action` | AUTH-001.1 | P0 | DONE |
| AUTH-001.3 | SQL migration | Tạo migration MariaDB/MySQL auth schema | AUTH-001.1 | P0 | DONE |
| AUTH-001.4 | Security defaults | Thêm lockout, 2FA fields, session revoke fields | AUTH-001.3 | P0 | DONE |
| AUTH-001.5 | Tests | Test permission helper và schema file tồn tại | AUTH-001.2 | P0 | DONE |

## Acceptance Criteria

- Có domain type cho auth.
- Có migration SQL chạy được trên MariaDB/MySQL.
- Password hash field không lưu plaintext.
- Có role/permission/session indexes.
- Có base fields cho 2FA và lockout.

## Result

- Thêm auth domain types: user, role, permission, session.
- Thêm permission key helper theo format `module:action`.
- Thêm migration MariaDB/MySQL `001_auth_schema.sql`.
- Schema có lockout fields, 2FA secret/recovery code, revoked session và audit logs.
- `npm.cmd test`: pass, 16 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
