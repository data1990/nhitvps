# FILE-004: Zip/Unzip

## Metadata

- ID: FILE-004
- Tên: Zip/unzip
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: FILE-001, SEC-001

## Mô tả

Thêm zip/unzip trong allowed roots, kiểm tra zip slip trước khi extract.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FILE-004.1 | Zip service | Zip file/folder trong allowed roots | FILE-001 | P1 | DONE |
| FILE-004.2 | Unzip service | Extract zip với zip-slip guard | FILE-001 | P1 | DONE |
| FILE-004.3 | Routes | `/files/zip`, `/files/unzip` | FILE-004.1 | P1 | DONE |
| FILE-004.4 | Tests | Test zip/unzip/zip-slip guard | FILE-004.3 | P1 | DONE |

## Acceptance Criteria

- Không extract path absolute hoặc `..`.
- Output vẫn nằm trong allowed roots.
- Zip/unzip cần `file:update`.

## Result

- Thêm zip/unzip bằng `adm-zip`.
- Kiểm tra entry absolute, drive path, null byte và `..` trước khi extract.
- Test zip-slip dùng ZIP crafted thủ công để giữ raw `../escape.txt`.
- `npm.cmd test`: pass, 37 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
