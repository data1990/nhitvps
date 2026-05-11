# FE-005: Operations UI

## Metadata

- ID: FE-005
- Ten: Operations UI
- Uu tien: P1
- Trang thai: DONE
- Dependency: FE-002, NGINX-004, DB-003, FW-002

## Mo ta

Them cac man hinh van hanh cho Nginx, MySQL/MariaDB va Firewall trong frontend dashboard.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| FE-005.1 | Websites screen | Form tao vhost, test config, reload va cap SSL | NGINX-004 | P1 | DONE |
| FE-005.2 | Databases screen | Form provision database/user, backup va restore | DB-003 | P1 | DONE |
| FE-005.3 | Security screen | Firewall status va apply rule form | FW-002 | P1 | DONE |
| FE-005.4 | Result handling | Hien thi response JSON va API error | FE-005.1 | P1 | DONE |
| FE-005.5 | Build verification | Frontend build pass | FE-005.4 | P1 | DONE |

## Acceptance Criteria

- Sidebar Websites goi duoc cac API Nginx co san.
- Sidebar Databases goi duoc provision/backup/restore API co san.
- Sidebar Security goi duoc firewall status/apply API co san.
- Khong hard-code secret production; password chi nam trong form state khi user nhap.
- Moi request dung `credentials: include` va de backend enforce RBAC.
- `npm run build` frontend pass.

## Result

- Added Operations UI for Websites, Databases and Security views.
- Added forms for Nginx vhost/SSL/runtime, database provision/backup/restore and firewall status/apply.
- Added shared operation result/error panel.
- Verification: frontend `npm.cmd run build` passed.
