# BE-001: Core Backend Scaffold

## Metadata

- ID: BE-001
- Tên: Core backend scaffold
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: None

## Mô tả

Khởi tạo backend Node.js Fastify theo clean architecture tối thiểu, có config riêng, env validation, logging, error handling, security middleware và health endpoint.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| BE-001.1 | Package setup | Tạo package.json, tsconfig, env example | None | P0 | DONE |
| BE-001.2 | Config module | Load env bằng Zod, không leak secret | BE-001.1 | P0 | DONE |
| BE-001.3 | App factory | Tạo Fastify app factory để test được bằng inject | BE-001.1 | P0 | DONE |
| BE-001.4 | Security plugins | Helmet, CORS, rate limit | BE-001.3 | P0 | DONE |
| BE-001.5 | Error handler | Chuẩn hóa error response | BE-001.3 | P0 | DONE |
| BE-001.6 | Health API | `/health` và `/ready` | BE-001.3 | P0 | DONE |
| BE-001.7 | Unit test | Test health và 404/error cơ bản | BE-001.6 | P0 | DONE |

## Acceptance Criteria

- Backend cài dependency được.
- `npm test` pass.
- `npm run build` pass.
- Server có thể start bằng `npm run dev`.
- API trả JSON thống nhất.
- Production mode không trả stack trace.

## Result

- `npm.cmd test`: pass, 3 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
- Local backend started at `http://127.0.0.1:8080` with PID `7976`.

## Security Notes

- Không có shell command trong task này.
- Không kết nối database trong task này.
- Tất cả env được validate trước khi server start.
- CORS origin phải lấy từ env, không hardcode mở toàn bộ trong production.
