# HOST-001: Host agent design

## Metadata

- ID: HOST-001
- Ten: Host agent design
- Uu tien: P0
- Trang thai: DONE
- Dependency: SEC-001, DEPLOY-001

## Mo ta

Thiet ke host agent rieng de tach cac thao tac quyen cao nhu UFW, Nginx, Certbot va system commands khoi backend/container mac dinh.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| HOST-001.1 | Boundary design | Xac dinh boundary Backend -> Host Agent -> privileged adapters | SEC-001 | P0 | DONE |
| HOST-001.2 | Transport design | Chon Unix socket/named pipe va metadata request | DEPLOY-001 | P0 | DONE |
| HOST-001.3 | Auth design | Khong forward session cookie, dung mTLS hoac signed token backend-agent | AUTH-003 | P0 | DONE |
| HOST-001.4 | Operation contract | Dinh nghia operation allowlist va payload rule | SEC-001 | P0 | DONE |
| HOST-001.5 | Safety/audit | Dinh nghia rollback, backup, timeout, output cap va audit event | SEC-001 | P0 | DONE |
| HOST-001.6 | Migration path | Ke hoach chuyen adapters hien tai sang HostAgentClient | DEPLOY-001 | P0 | DONE |

## Acceptance Criteria

- Co tai lieu design ro rang trong `docs/host-agent.md`.
- Backend/container mac dinh khong can privileged hoac Docker socket.
- Host agent chi chap nhan operation allowlist, khong shell string tuy y.
- Co yeu cau audit va rollback cho thao tac nguy hiem.
- Co migration path tu adapters hien tai sang client agent.

## Result

- Added `docs/host-agent.md`.
- Design covers process boundary, transport, authentication, operation contract, safety controls, audit, deployment and migration path.
