# DOC-001: OpenAPI documentation

## Metadata

- ID: DOC-001
- Tên: OpenAPI documentation
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo OpenAPI document cho API hiện tại và endpoint phục vụ tài liệu để frontend, CI hoặc công cụ API client có thể dùng chung.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| DOC-001.1 | OpenAPI document | Mô tả endpoint, auth cookie, request/response chính | BE-001 | P2 | DONE |
| DOC-001.2 | Docs route | Serve OpenAPI JSON qua API backend | DOC-001.1 | P2 | DONE |
| DOC-001.3 | Docs guide | Tài liệu cách truy cập và dùng spec | DOC-001.2 | P2 | DONE |
| DOC-001.4 | Tests | Test endpoint OpenAPI không cần auth và có path chính | DOC-001.2 | P2 | DONE |

## Acceptance Criteria

- Có endpoint `GET /api/v1/docs/openapi.json`.
- OpenAPI document có security scheme cho session cookie.
- Document liệt kê các module chính: auth, file manager, nginx, database, firewall, monitoring.
- Có test xác nhận spec trả JSON hợp lệ.
- Local test/build/audit pass.

## Result

- Added OpenAPI document module and `GET /api/v1/docs/openapi.json`.
- Added session cookie security scheme and `x-required-permissions` metadata for protected routes.
- Added API documentation guide in `docs/api.md`.
- Added docs route test.
- Verification: `npm test` passed 82 tests, `npm run build` passed, `npm audit --audit-level=moderate` found 0 vulnerabilities.
