# SEC-002: Path Sandbox Policy

## Metadata

- ID: SEC-002
- Tên: Path sandbox policy
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo utility resolve path an toàn để File Manager không bị path traversal hoặc symlink escape khỏi allowed roots.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| SEC-002.1 | Sandbox model | Định nghĩa allowed roots và result type | BE-001 | P0 | DONE |
| SEC-002.2 | Path normalization | Resolve absolute/relative path, chặn null byte | SEC-002.1 | P0 | DONE |
| SEC-002.3 | Root enforcement | Chỉ cho path nằm trong allowed roots | SEC-002.2 | P0 | DONE |
| SEC-002.4 | Symlink check | Dùng `realpath` cho existing path để chặn symlink escape | SEC-002.3 | P0 | DONE |
| SEC-002.5 | Tests | Test allowed/traversal/symlink escape | SEC-002.4 | P0 | DONE |

## Acceptance Criteria

- Path traversal bị chặn.
- Path ngoài root bị chặn.
- Existing symlink escape bị chặn.
- Test pass.

## Result

- Implement `PathSandbox` cho allowed roots.
- Chặn empty/null byte/path outside root/traversal.
- `resolveExisting` dùng `realpath` để phát hiện symlink escape.
- Covered bởi `backend/tests/path-sandbox.test.ts`.
