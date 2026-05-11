# AUTH-004: 2FA TOTP

## Metadata

- ID: AUTH-004
- Tên: 2FA TOTP
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: AUTH-002

## Mô tả

Xây dựng service nền tảng cho TOTP 2FA và recovery codes. API setup/verify sẽ gắn vào flow user profile sau khi có persistent repository.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AUTH-004.1 | Secret generator | Sinh base32 secret an toàn | AUTH-002 | P1 | DONE |
| AUTH-004.2 | TOTP generator | Sinh OTP theo RFC 6238 SHA-1/30s/6 digits | AUTH-004.1 | P1 | DONE |
| AUTH-004.3 | TOTP verifier | Verify token với clock skew giới hạn | AUTH-004.2 | P1 | DONE |
| AUTH-004.4 | Recovery codes | Generate/hash/verify recovery codes | AUTH-004.1 | P1 | DONE |
| AUTH-004.5 | Tests | Test known vector, verify skew, recovery hash | AUTH-004.4 | P1 | DONE |

## Acceptance Criteria

- Không dùng `Math.random`.
- TOTP verify dùng timing-safe compare.
- Recovery code chỉ lưu hash.
- Test pass.

## Result

- Thêm `TotpService` RFC 6238.
- Thêm base32 encode/decode.
- Thêm recovery code service với SHA-256 hash và timing-safe verify.
- `npm.cmd test`: pass, 28 tests.
- `npm.cmd run build`: pass.
- `npm.cmd audit --audit-level=moderate`: pass, 0 vulnerabilities.
