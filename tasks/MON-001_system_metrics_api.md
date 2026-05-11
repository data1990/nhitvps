# MON-001: System metrics API

## Metadata

- ID: MON-001
- Tên: System metrics API
- Ưu tiên: P2
- Trạng thái: DONE
- Dependency: BE-001

## Mô tả

Tạo service và API lấy snapshot hệ thống: CPU, RAM, disk, network, process và Docker detection nếu có. Task này chỉ trả snapshot theo request; realtime stream thuộc MON-002.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| MON-001.1 | Metrics service | Lấy CPU/RAM/disk/network/process bằng Node API và `/proc` khi có | BE-001 | P2 | DONE |
| MON-001.2 | Docker detection | Detect Docker socket/process fallback không gọi shell | MON-001.1 | P2 | DONE |
| MON-001.3 | Routes | API protected by `monitoring:read` | AUTH-003 | P2 | DONE |
| MON-001.4 | Tests | Test snapshot shape và RBAC | MON-001.3 | P2 | DONE |

## Acceptance Criteria

- Không gọi shell cho metrics snapshot.
- Disk path nằm trong config allowlist.
- API cần session và permission `monitoring:read`.
- Response không chứa secret/env nhạy cảm.
- Test pass.

## Result

- Added `SystemMetricsService` for CPU/RAM/disk/network/process/Docker snapshot.
- Disk metrics use configured `MONITOR_DISK_PATHS`.
- Network/process metrics read `/proc` when available and degrade safely when unavailable.
- Added `GET /api/v1/monitoring/system` requiring `monitoring:read`.
- Verification:
  - `npm.cmd test`: PASS, 78 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
