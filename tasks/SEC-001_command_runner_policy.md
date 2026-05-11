# SEC-001: Command Runner Policy

## Metadata

- ID: SEC-001
- Tên: Command runner policy
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo command runner dùng `spawn` không qua shell, có policy allowlist, timeout, validate arguments, giới hạn output và audit hook.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| SEC-001.1 | Policy model | Định nghĩa command policy và request/result type | BE-001 | P0 | DONE |
| SEC-001.2 | Argument validation | Chặn arg rỗng, control char, shell metachar và vượt limit | SEC-001.1 | P0 | DONE |
| SEC-001.3 | Spawn runner | Chạy command qua arg array, timeout, output cap | SEC-001.2 | P0 | DONE |
| SEC-001.4 | Audit hook | Gọi audit start/success/failure/blocked | SEC-001.3 | P0 | DONE |
| SEC-001.5 | Tests | Test allow/block/timeout/arg injection | SEC-001.3 | P0 | DONE |

## Acceptance Criteria

- Không dùng `exec` hoặc shell string.
- Chỉ chạy policy id đã đăng ký.
- Không cho argument chứa metachar nguy hiểm.
- Timeout kill process.
- Test pass.

## Result

- Implement `CommandRunner` dùng `spawn` với `shell: false`.
- Có policy allowlist, allowed subcommand, arg validation, timeout, output cap.
- Có audit hook cho blocked/started/succeeded/failed/timeout.
- Covered bởi `backend/tests/command-runner.test.ts`.
