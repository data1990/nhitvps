# OPS-002: Rollback manager

## Metadata

- ID: OPS-002
- Ten: Rollback manager
- Uu tien: P1
- Trang thai: DONE
- Dependency: OPS-001

## Mo ta

Them rollback manager cho database backup va Nginx config backup, co audit log va pre-rollback backup truoc khi overwrite config.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| OPS-002.1 | Rollback service | Them `RollbackManager` cho database va Nginx config | OPS-001 | P1 | DONE |
| OPS-002.2 | Database restore integration | Goi `DatabaseBackupService.restoreDatabase` qua backup sandbox | DB-003 | P1 | DONE |
| OPS-002.3 | Nginx config rollback | Restore `.conf` file hoac config directory tu backup dir | NGINX-002 | P1 | DONE |
| OPS-002.4 | Pre-rollback backup | Backup config hien tai truoc khi overwrite | OPS-002.3 | P1 | DONE |
| OPS-002.5 | Audit log | Append JSONL audit event cho rollback thanh cong | OPS-002.1 | P1 | DONE |
| OPS-002.6 | Tests | Test database restore audit va Nginx config rollback | OPS-002.5 | P1 | DONE |

## Acceptance Criteria

- Restore database chi doc backup trong database backup dir.
- Restore Nginx chi doc backup trong Nginx backup dir duoc cau hinh.
- Truoc khi overwrite config hien tai phai tao pre-rollback backup.
- Audit log khong chua secret.
- Backend test/build pass.

## Result

- Added `backend/src/modules/operations/application/rollback-manager.ts`.
- Added rollback tests in `backend/tests/rollback-manager.test.ts`.
- Verification: backend `npm.cmd test` passed 86 tests.
- Verification: backend `npm.cmd run build` passed.
