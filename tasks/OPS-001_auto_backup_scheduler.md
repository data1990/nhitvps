# OPS-001: Auto backup scheduler

## Metadata

- ID: OPS-001
- Ten: Auto backup scheduler
- Uu tien: P1
- Trang thai: DONE
- Dependency: DB-003, NGINX-002

## Mo ta

Them scheduler backup tu dong cho database va Nginx config, co retention policy va mac dinh tat cho den khi duoc cau hinh.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| OPS-001.1 | Env config | Them env bat/tat scheduler, database list, interval, retention va backup dir | DB-003 | P1 | DONE |
| OPS-001.2 | Scheduler service | Them `AutoBackupScheduler` co start/stop/runOnce | DB-003 | P1 | DONE |
| OPS-001.3 | Database backup integration | Goi `DatabaseBackupService.backupDatabase` cho danh sach database cau hinh | DB-003 | P1 | DONE |
| OPS-001.4 | Nginx config backup | Copy `sites-available` vao auto backup dir theo timestamp | NGINX-002 | P1 | DONE |
| OPS-001.5 | Retention policy | Xoa backup cu hon retention trong auto backup dir | OPS-001.2 | P1 | DONE |
| OPS-001.6 | Tests | Test backup database/config va prune retention | OPS-001.5 | P1 | DONE |

## Acceptance Criteria

- Scheduler mac dinh tat qua `AUTO_BACKUP_ENABLED=false`.
- Khi bat, Fastify start scheduler va stop khi app close.
- Database backup dung service DB-003, khong goi shell truc tiep.
- Nginx config backup chi copy file config, khong reload service.
- Retention chi xoa trong auto backup dir.
- Backend test/build pass.

## Result

- Added `backend/src/modules/operations/application/auto-backup-scheduler.ts`.
- Added env: `AUTO_BACKUP_ENABLED`, `AUTO_BACKUP_DATABASES`, `AUTO_BACKUP_INTERVAL_MINUTES`, `AUTO_BACKUP_RETENTION_DAYS`, `AUTO_BACKUP_DIR`.
- Wired scheduler startup to `buildApp` when enabled.
- Added tests in `backend/tests/auto-backup-scheduler.test.ts`.
- Verification: backend `npm.cmd test` passed 84 tests.
- Verification: backend `npm.cmd run build` passed.
