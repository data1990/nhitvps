# DB-001: Database manager model

## Metadata

- ID: DB-001
- Tên: Database manager model
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: AUTH-003

## Mô tả

Thiết kế domain model và migration metadata cho module quản lý MySQL/MariaDB. Task này chỉ tạo model/validator/schema nền tảng; thao tác tạo database/user thật sẽ thuộc DB-002.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| DB-001.1 | Domain types | Tạo type cho database, user, grant, backup metadata | AUTH-003 | P1 | DONE |
| DB-001.2 | Validators | Validate identifier/user/host/privilege an toàn | DB-001.1 | P1 | DONE |
| DB-001.3 | Migration | Tạo metadata schema cho managed databases/users/grants/backups/slow query settings | DB-001.1 | P1 | DONE |
| DB-001.4 | Tests | Test validator và quote identifier | DB-001.2 | P1 | DONE |

## Acceptance Criteria

- Có domain model rõ ràng cho MySQL/MariaDB manager.
- Có migration metadata không lưu plaintext password.
- Có validator chặn SQL injection qua identifier/user/host.
- Có helper quote identifier an toàn cho DB-002.
- Test pass.

## Result

- Added database manager domain types for database, user, grant, backup metadata, and slow query settings.
- Added validation helpers for MySQL/MariaDB identifiers, usernames, hosts, secret refs, checksums, and privileges.
- Added safe `quoteMySqlIdentifier` helper for future DB-002 SQL rendering.
- Added metadata migration `002_database_manager_schema.sql`.
- Verification:
  - `npm.cmd test`: PASS, 55 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
