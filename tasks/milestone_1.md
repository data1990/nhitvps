# Milestone 1: Core Backend Foundation

## Scope

Tạo nền backend an toàn để các module privileged sau này có thể phát triển mà không gọi trực tiếp shell/filesystem/database từ controller.

## Tasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| BE-001 | Core backend scaffold | Tạo Fastify backend với config, logging, error handler, health API, security middleware | None | P0 | DONE |
| BE-002 | API error contract | Chuẩn hóa error response và request id | BE-001 | P0 | DONE |
| SEC-001 | Command runner policy | Tạo command runner allowlist, timeout, argument array, audit hook | BE-001 | P0 | DONE |
| SEC-002 | Path sandbox policy | Tạo utility validate path chống traversal/symlink escape | BE-001 | P0 | DONE |

## Definition of Done

- `npm test` pass trong backend.
- Server start được với env mẫu.
- Health endpoint trả trạng thái ok.
- Security headers/rate limit được register.
- Error handler không leak stack trong production.
