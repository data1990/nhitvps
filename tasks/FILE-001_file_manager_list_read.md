# FILE-001: File Manager List/Read

## Metadata

- ID: FILE-001
- Tên: File manager list/read
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: SEC-002, AUTH-003

## Mô tả

Tạo API browse và read file trong allowed roots. Endpoint phải được bảo vệ bằng RBAC `file:read`.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FILE-001.1 | Config roots | Thêm cấu hình allowed file roots | SEC-002 | P1 | DONE |
| FILE-001.2 | List service | List directory an toàn qua PathSandbox | FILE-001.1 | P1 | DONE |
| FILE-001.3 | Read service | Read text file có size limit | FILE-001.1 | P1 | DONE |
| FILE-001.4 | Routes | `/files/list`, `/files/read` protected by `file:read` | AUTH-003 | P1 | DONE |
| FILE-001.5 | Tests | Test list/read/traversal/auth | FILE-001.4 | P1 | DONE |

## Acceptance Criteria

- Không đọc ngoài allowed roots.
- Existing symlink escape bị chặn qua `realpath`.
- Read file có size limit.
- Endpoint thiếu auth trả `AUTH_REQUIRED`.
- Endpoint thiếu quyền trả `FORBIDDEN`.

## Result

- Thêm FileManagerService list/read.
- Thêm API `/api/v1/files/roots`, `/api/v1/files/list`, `/api/v1/files/read`.
- Endpoint được bảo vệ bằng RBAC `file:read`.
- Path traversal bị chặn qua PathSandbox.
- Read file có size limit.
- `npm.cmd test`: pass, 32 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
