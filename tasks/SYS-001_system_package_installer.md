# SYS-001: System package installer

## Metadata

- Ten: System package installer
- Loai: Backend + Frontend
- Uu tien: P1
- Trang thai: DONE
- Phu thuoc: SEC-001, AUTH-003

## Muc tieu

Them kha nang kiem tra va cai dat cac thanh phan he thong co ban tu panel: Nginx, MySQL, MariaDB, UFW va Certbot.

## Pham vi

| ID | Hang muc | Mo ta | Trang thai |
| --- | --- | --- | --- |
| SYS-001.1 | Package service | Service backend cai dat/status qua CommandRunner allowlist | DONE |
| SYS-001.2 | API routes | Protected endpoints cho status/install/install-stack | DONE |
| SYS-001.3 | OpenAPI | Mo ta endpoint system package trong OpenAPI | DONE |
| SYS-001.4 | UI Settings | Man hinh Server Setup de check/install tung component hoac common stack | DONE |
| SYS-001.5 | Tests | Route tests voi mock executor, khong chay lenh that | DONE |

## Ghi chu van hanh

- Endpoint yeu cau quyen `system:manage`.
- Lenh thuc te dung `apt-get`, `dpkg`, `systemctl`; phu hop Ubuntu/Debian VPS co quyen host can thiet.
- Moi lenh di qua policy allowlist, argument array, timeout va output cap.
