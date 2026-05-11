# AUTH-002: Login/Session API

## Metadata

- ID: AUTH-002
- Tên: Login/session API
- Ưu tiên: P0
- Trạng thái: DONE
- Dependency: AUTH-001

## Mô tả

Xây dựng API đăng nhập, đăng xuất và kiểm tra session hiện tại. Task này dùng repository interface và in-memory adapter để giữ clean architecture; MySQL adapter sẽ triển khai sau.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AUTH-002.1 | Password hasher | Hash/verify password bằng scrypt và timing-safe compare | AUTH-001 | P0 | DONE |
| AUTH-002.2 | Session token service | Sinh random token, hash token bằng SHA-256 | AUTH-001 | P0 | DONE |
| AUTH-002.3 | Auth service | Login/logout/current user use case | AUTH-002.1 | P0 | DONE |
| AUTH-002.4 | Repository interface | User/session repository boundary và in-memory adapter | AUTH-001 | P0 | DONE |
| AUTH-002.5 | Auth routes | `/auth/login`, `/auth/logout`, `/auth/me` | AUTH-002.3 | P0 | DONE |
| AUTH-002.6 | Tests | Test success/fail/logout/me/lockout basics | AUTH-002.5 | P0 | DONE |

## Acceptance Criteria

- Login không trả password hash.
- Session token chỉ lưu hash.
- Cookie httpOnly, sameSite, secure theo môi trường.
- Logout revoke session.
- Disabled/locked user không login được.
- Test pass.

## Result

- Login/logout/me API hoạt động qua repository boundary.
- Password hash bằng scrypt, verify bằng timing-safe compare.
- Session token random 32 bytes, lưu hash SHA-256.
- Cookie httpOnly/sameSite/secure theo env.
- `npm.cmd test`: pass, 20 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
