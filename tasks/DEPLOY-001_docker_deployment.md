# DEPLOY-001: Docker deployment

## Metadata

- ID: DEPLOY-001
- Tên: Docker deployment
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo bộ triển khai Docker cho backend API và MariaDB, có env mẫu, healthcheck, volume dữ liệu và hướng dẫn chạy. Cấu hình mặc định phải an toàn, không chạy privileged container khi chưa có lý do rõ ràng.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| DEPLOY-001.1 | Dockerfile backend | Multi-stage build cho Node.js backend | BE-001 | P2 | DONE |
| DEPLOY-001.2 | Compose stack | Compose cho backend, MariaDB và volume dữ liệu | DEPLOY-001.1 | P2 | DONE |
| DEPLOY-001.3 | Env sample | Env mẫu không chứa secret thật | DEPLOY-001.2 | P2 | DONE |
| DEPLOY-001.4 | Deployment docs | README hướng dẫn build/run/healthcheck/rollback | DEPLOY-001.2 | P2 | DONE |

## Acceptance Criteria

- Có Dockerfile build production image cho backend.
- Compose có healthcheck và persistent volumes.
- Env mẫu không chứa secret thật và yêu cầu đổi secret production.
- Tài liệu nêu rõ giới hạn khi chạy container không privileged.
- Test/build/audit pass sau khi thêm file triển khai.

## Result

- Added production multi-stage backend Dockerfile with non-root runtime user and healthcheck.
- Added Docker Compose stack for backend and MariaDB with persistent volumes and service healthchecks.
- Added deployment env sample with placeholder secrets only.
- Added deployment README covering run, healthcheck, rollback and security notes.
- Verification: `npm test` passed 81 tests, `npm run build` passed, `npm audit --audit-level=moderate` found 0 vulnerabilities.
- Docker CLI is not installed in this workspace, so `docker compose config` could not be executed locally.
