# FE-004: Monitoring UI

## Metadata

- ID: FE-004
- Ten: Monitoring UI
- Uu tien: P1
- Trang thai: DONE
- Dependency: FE-002, MON-002

## Mo ta

Them giao dien monitoring trong frontend de doc snapshot he thong va stream realtime qua WebSocket.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| FE-004.1 | Monitoring navigation | Them view Monitoring trong dashboard protected | FE-002 | P1 | DONE |
| FE-004.2 | Snapshot client | Goi `/monitoring/system` voi `credentials: include` | MON-001 | P1 | DONE |
| FE-004.3 | Metrics dashboard | Hien thi CPU, memory, disk, network, process va Docker status | FE-004.2 | P1 | DONE |
| FE-004.4 | WebSocket stream | Ket noi `/monitoring/system/stream?intervalMs=3000` va cap nhat snapshot realtime | MON-002 | P1 | DONE |
| FE-004.5 | Build verification | Frontend build pass | FE-004.4 | P1 | DONE |

## Acceptance Criteria

- View Monitoring nam trong dashboard protected sau login.
- Snapshot dung API backend va khong hard-code metrics.
- WebSocket dung protocol ws/wss phu hop voi `VITE_API_BASE_URL`.
- Stream co nut start/stop va hien thi loi khi backend tu choi.
- `npm run build` frontend pass.

## Result

- Added Monitoring view with manual refresh and stream controls.
- Added cards and panels for CPU, memory, disk, network, Docker and top processes.
- Added WebSocket client for `system_metrics` events.
- Verification: frontend `npm.cmd run build` passed.
