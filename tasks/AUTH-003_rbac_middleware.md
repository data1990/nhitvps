# AUTH-003: RBAC Middleware

## Metadata

- ID: AUTH-003
- Tên: RBAC middleware
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: AUTH-001

## Mô tả

Tạo authorization service và Fastify permission guard để các module privileged có thể bảo vệ endpoint bằng `module:action`.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AUTH-003.1 | Permission lookup | Thêm repository method lấy permission của user | AUTH-001 | P0 | DONE |
| AUTH-003.2 | Authorization service | Kiểm tra exact/module manage/system manage permission | AUTH-003.1 | P0 | DONE |
| AUTH-003.3 | Fastify guard | Middleware authenticate session và assert permission | AUTH-002 | P0 | DONE |
| AUTH-003.4 | Tests | Test allow/deny/unauthenticated cases | AUTH-003.3 | P0 | DONE |

## Acceptance Criteria

- Exact permission cho phép action tương ứng.
- `module:manage` cho phép mọi action trong module đó.
- `system:manage` cho phép toàn bộ.
- Missing session trả `AUTH_REQUIRED`.
- Missing permission trả `FORBIDDEN`.

## Result

- Thêm `AuthorizationService`.
- Thêm `createPermissionGuard` cho Fastify preHandler.
- Exact permission, `module:manage`, `system:manage` đều được test.
- `npm.cmd test`: pass, 24 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
