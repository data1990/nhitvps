# Milestone 2: Authentication & Access Control

## Scope

Xây dựng nền tảng user/session/RBAC trước khi mở các chức năng quản trị hệ thống.

## Tasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | User model and migration | Thiết kế bảng users/roles/permissions/sessions | BE-001 | P0 | DONE |
| AUTH-002 | Login/session API | Đăng nhập, đăng xuất, session cookie, rate limit | AUTH-001 | P0 | DONE |
| AUTH-003 | RBAC middleware | Permission guard theo role/module/action | AUTH-001 | P0 | DONE |
| AUTH-004 | 2FA TOTP | Setup/verify/recovery codes | AUTH-002 | P1 | DONE |

## Definition of Done

- Có migration database.
- Có password hashing.
- Login/logout/session pass test.
- RBAC guard test được.
- 2FA setup/verify có test cơ bản.
