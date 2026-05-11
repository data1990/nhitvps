# MON-002: WebSocket metrics stream

## Metadata

- ID: MON-002
- Tên: WebSocket metrics stream
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: MON-001

## Mô tả

Tạo WebSocket endpoint stream realtime metrics snapshot định kỳ cho frontend. Stream phải có session auth và RBAC `monitoring:read`; interval bị giới hạn để tránh abuse.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| MON-002.1 | WebSocket plugin | Register Fastify WebSocket plugin | BE-001 | P2 | DONE |
| MON-002.2 | Stream route | `/monitoring/system/stream` gửi snapshot định kỳ | MON-001 | P2 | DONE |
| MON-002.3 | Auth/RBAC | Xác thực cookie/session và permission `monitoring:read` | AUTH-003 | P2 | DONE |
| MON-002.4 | Tests | Test auth failure, stream success và interval clamp | MON-002.3 | P2 | DONE |

## Acceptance Criteria

- WebSocket endpoint yêu cầu auth và RBAC.
- Interval query bị clamp trong khoảng an toàn.
- Mỗi message là JSON event có type rõ ràng.
- Timer được clear khi socket đóng.
- Test pass.

## Result

- Registered `@fastify/websocket` through `backend/src/plugins/websocket.ts`.
- Added `GET /api/v1/monitoring/system/stream` to stream `system_metrics` JSON events.
- Protected the stream with session authentication and RBAC `monitoring:read`.
- Clamped `intervalMs` between 1000ms and 60000ms, default 5000ms.
- Cleared interval timers when sockets close.
- Verification: `npm test` passed 81 tests, `npm run build` passed, `npm audit --audit-level=moderate` found 0 vulnerabilities.
