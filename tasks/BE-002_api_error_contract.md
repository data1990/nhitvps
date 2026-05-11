# BE-002: API Error Contract

## Metadata

- ID: BE-002
- Tên: API error contract
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Chuẩn hóa response lỗi và request id để frontend, audit log và các module privileged dùng cùng một contract.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| BE-002.1 | Error response type | Tạo type/helper response lỗi thống nhất | BE-001 | P0 | DONE |
| BE-002.2 | Request id header | Trả `x-request-id` trong mọi response | BE-001 | P0 | DONE |
| BE-002.3 | Validation error mapping | Map validation error về code chuẩn | BE-002.1 | P0 | DONE |
| BE-002.4 | Tests | Test AppError, not found, request id | BE-002.1 | P0 | DONE |

## Acceptance Criteria

- Mọi lỗi có `error.code`, `error.message`, `error.requestId`.
- Response có header `x-request-id`.
- Production không leak stack trace.
- Test pass.

## Result

- Thêm `ApiErrorResponse` và `createApiErrorResponse`.
- Thêm `x-request-id` header cho response.
- AppError/not-found/validation mapping theo code chuẩn.
- Covered bởi `backend/tests/health.test.ts`.
