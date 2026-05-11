# DB-003: Backup/restore database

## Metadata

- ID: DB-003
- Tên: Backup/restore database
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: DB-002, SEC-001

## Mô tả

Tạo service và API backup/restore MySQL/MariaDB bằng `mysqldump`/`mysql` thông qua CommandRunner allowlist. Backup phải có checksum SHA-256; restore phải verify checksum nếu client cung cấp.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| DB-003.1 | Command policies | Allowlist `mysqldump` và `mysql` với timeout/output cap | SEC-001 | P1 | DONE |
| DB-003.2 | Backup service | Dump database ra backup dir và tính checksum | DB-002 | P1 | DONE |
| DB-003.3 | Restore service | Restore từ file trong sandbox và verify checksum | DB-003.2 | P1 | DONE |
| DB-003.4 | Routes | API protected by `backup:create` và `database:restore` | AUTH-003 | P1 | DONE |
| DB-003.5 | Tests | Test validation, command args, checksum, RBAC | DB-003.4 | P1 | DONE |

## Acceptance Criteria

- Không dùng shell redirection.
- Command chạy qua CommandRunner allowlist.
- Không đưa database password vào command args.
- Backup file nằm trong backup dir sandbox.
- Restore verify checksum khi được cung cấp.
- Test pass.

## Result

- Added database backup/restore service using CommandRunner policies `mysqldump:database` and `mysql:restore`.
- Backup writes dump output to a sandboxed backup directory and calculates SHA-256 checksum.
- Restore reads only from backup sandbox and verifies checksum when supplied.
- MySQL client credentials are written to a temporary defaults file, not command args, and removed after execution.
- Added protected APIs:
  - `POST /api/v1/databases/backups` requiring `backup:create`
  - `POST /api/v1/databases/restore` requiring `database:restore`
- Verification:
  - `npm.cmd test`: PASS, 65 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
