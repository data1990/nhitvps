# FILE-003: File Edit/Chmod/Chown

## Metadata

- ID: FILE-003
- Tên: File edit/chmod/chown
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: FILE-001, SEC-001

## Mô tả

Thêm API edit file text, chmod và chown qua filesystem API an toàn, không gọi shell.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FILE-003.1 | Write service | Ghi text file có size limit và sandbox | FILE-001 | P1 | DONE |
| FILE-003.2 | Chmod service | Validate mode octal và dùng `fs.chmod` | FILE-001 | P1 | DONE |
| FILE-003.3 | Chown service | Validate uid/gid numeric và dùng `fs.chown` | FILE-001 | P1 | DONE |
| FILE-003.4 | Routes | `/files/write`, `/files/chmod`, `/files/chown` | FILE-003.1 | P1 | DONE |
| FILE-003.5 | Tests | Test write/chmod/validation/traversal | FILE-003.4 | P1 | DONE |

## Acceptance Criteria

- Không gọi shell.
- Chặn path traversal.
- Edit có size limit.
- chmod/chown cần `file:update`.

## Result

- Thêm write text file có size limit.
- Thêm chmod/chown bằng `fs.chmod` và `fs.chown`, không gọi shell.
- Validate mode, uid, gid.
- `npm.cmd test`: pass, 37 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
