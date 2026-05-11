# Milestone 3: Frontend & Operations

## Scope

Hoàn thiện trải nghiệm quản trị bằng UI và bổ sung các luồng vận hành còn thiếu.

## Tasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FE-001 | Frontend scaffold | Tạo React + Tailwind dashboard shell | DOC-001 | P1 | DONE |
| FE-002 | Auth UI | Login/logout/session state và protected routes | FE-001, AUTH-002 | P1 | DONE |
| FE-003 | File manager UI | Browse/read/upload/download/edit/chmod/chown/zip/unzip | FE-002, FILE-004 | P1 | DONE |
| FE-004 | Monitoring UI | Dashboard CPU/RAM/Disk/Network và WebSocket stream | FE-002, MON-002 | P1 | DONE |
| FE-005 | Operations UI | Nginx/MySQL/Firewall screens | FE-002, NGINX-004, DB-003, FW-002 | P1 | DONE |
| OPS-001 | Auto backup scheduler | Lịch backup database/config và retention policy | DB-003, NGINX-002 | P1 | DONE |
| OPS-002 | Rollback manager | Rollback config/database backup có audit log | OPS-001 | P1 | DONE |
| HOST-001 | Host agent design | Tách agent quyền cao cho UFW/Nginx/Certbot/system commands | SEC-001, DEPLOY-001 | P0 | DONE |

## Definition of Done

- UI build pass.
- Dashboard hiển thị API status.
- Có task chi tiết cho auth/file/monitoring/operations UI.
- Các tác vụ quyền cao được đưa vào host agent thay vì tăng quyền mặc định cho container backend.
