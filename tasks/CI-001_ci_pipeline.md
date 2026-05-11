# CI-001: CI pipeline

## Metadata

- ID: CI-001
- Tên: CI pipeline
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo pipeline CI để kiểm tra backend và cấu hình Docker trước khi merge/deploy. Pipeline phải chạy build, unit test, audit dependency và validate Docker artifacts.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| CI-001.1 | Backend CI job | Cài dependency, audit, build, test | BE-001 | P2 | DONE |
| CI-001.2 | Docker validation job | Validate compose và Docker build | DEPLOY-001 | P2 | DONE |
| CI-001.3 | Workflow hardening | Permissions tối thiểu, concurrency, timeout | CI-001.1 | P2 | DONE |
| CI-001.4 | Documentation update | Ghi log task và kết quả kiểm thử | CI-001.3 | P2 | DONE |

## Acceptance Criteria

- Workflow chạy trên push và pull request.
- Backend job chạy `npm ci`, `npm audit`, `npm run build`, `npm test`.
- Docker job validate compose và build Dockerfile backend.
- Workflow dùng permissions tối thiểu và timeout hợp lý.
- Local test/build/audit pass.

## Result

- Added GitHub Actions workflow `.github/workflows/ci.yml`.
- Backend job runs `npm ci`, `npm audit --audit-level=moderate`, `npm run build`, and `npm test`.
- Docker job validates compose config with `.env.example` and builds the backend image.
- Workflow uses read-only repository permission, concurrency cancellation and job timeouts.
- Verification: `npm test` passed 81 tests, `npm run build` passed, `npm audit --audit-level=moderate` found 0 vulnerabilities.
