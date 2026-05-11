# FE-002: Auth UI

## Metadata

- ID: FE-002
- Ten: Auth UI
- Uu tien: P1
- Trang thai: DONE
- Dependency: FE-001, AUTH-002

## Mo ta

Them UI dang nhap/dang xuat va session state cho frontend. Dashboard shell chi hien thi sau khi `/auth/me` xac nhan session hop le.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| FE-002.1 | Auth API client | Goi `/auth/me`, `/auth/login`, `/auth/logout` voi `credentials: include` | FE-001 | P1 | DONE |
| FE-002.2 | Session bootstrap | Kiem tra session khi app load va chuyen trang thai authenticated/unauthenticated | FE-002.1 | P1 | DONE |
| FE-002.3 | Login screen | Them form email/username + password, loading state va error state | FE-002.1 | P1 | DONE |
| FE-002.4 | Protected shell | Chi render dashboard khi co session, hien thi user va session expiry | FE-002.2 | P1 | DONE |
| FE-002.5 | Logout action | Goi logout API, xoa session state va quay ve login | FE-002.4 | P1 | DONE |
| FE-002.6 | Build verification | Frontend build pass | FE-002.5 | P1 | DONE |

## Acceptance Criteria

- App bootstrap session bang `/api/v1/auth/me`.
- Login dung endpoint `/api/v1/auth/login` va gui cookie bang `credentials: include`.
- Logout dung endpoint `/api/v1/auth/logout`.
- Dashboard khong hien thi khi chua dang nhap.
- Login errors hien thi ro rang, khong leak secret.
- `npm run build` frontend pass.

## Result

- Added auth session state in `frontend/src/App.tsx`.
- Added login screen with API status, username/email field, password field, loading state and error state.
- Added protected dashboard shell with signed-in user, session expiry and logout button.
- Auth requests use `credentials: include` for httpOnly session cookie flow.
- Verification: frontend `npm.cmd run build` passed.
- Verification: frontend `npm.cmd audit --audit-level=moderate` found 0 vulnerabilities.
- Browser verification: in-app browser showed the sign-in screen at `http://127.0.0.1:5173` and reported no console errors.
