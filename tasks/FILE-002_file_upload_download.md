# FILE-002: File Upload/Download

## Metadata

- ID: FILE-002
- Tên: File upload/download
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: FILE-001

## Mô tả

Thêm download và upload file trong allowed roots, có RBAC và size limit.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FILE-002.1 | Download service | Stream file download an toàn | FILE-001 | P1 | DONE |
| FILE-002.2 | Upload service | Multipart upload có limit và path sandbox | FILE-001 | P1 | DONE |
| FILE-002.3 | Routes | `/files/download`, `/files/upload` | FILE-002.1 | P1 | DONE |
| FILE-002.4 | Tests | Test download/upload/traversal/permission | FILE-002.3 | P1 | DONE |

## Acceptance Criteria

- Download chỉ đọc file trong allowed roots.
- Upload chỉ ghi vào allowed roots.
- Upload có size limit.
- Download cần `file:read`.
- Upload cần `file:update`.

## Result

- Thêm multipart upload qua `@fastify/multipart`.
- Thêm download stream endpoint.
- Upload cần `file:update`, download cần `file:read`.
- `npm.cmd test`: pass, 37 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
