# FE-003: File manager UI

## Metadata

- ID: FE-003
- Ten: File manager UI
- Uu tien: P1
- Trang thai: DONE
- Dependency: FE-002, FILE-004

## Mo ta

Them giao dien File Manager trong frontend de thao tac voi cac API file da co: browse/read/upload/download/edit/chmod/chown/zip/unzip.

## Subtasks

| ID | Ten | Mo ta | Dependency | Uu tien | Trang thai |
| --- | --- | --- | --- | --- | --- |
| FE-003.1 | Navigation state | Cho sidebar mo view Files thay vi chi hien overview | FE-002 | P1 | DONE |
| FE-003.2 | Roots and directory listing | Goi `/files/roots` va `/files/list`, hien thi bang file/folder | FILE-001 | P1 | DONE |
| FE-003.3 | File read/editor | Goi `/files/read`, hien thi editor text va metadata file | FILE-001 | P1 | DONE |
| FE-003.4 | File write/download/upload | Goi `/files/write`, `/files/download`, `/files/upload` voi cookie session | FILE-003 | P1 | DONE |
| FE-003.5 | Permissioned operations | Them controls cho chmod, chown, zip va unzip | FILE-004 | P1 | DONE |
| FE-003.6 | Build verification | Frontend build pass | FE-003.5 | P1 | DONE |

## Acceptance Criteria

- View Files nam trong dashboard protected sau login.
- Roots va list directory dung API backend, khong hard-code path.
- Open file chi doc regular file va hien thi loi API neu backend tu choi.
- Upload dung multipart form-data voi `credentials: include`.
- Download dung blob response, khong expose session token.
- Write/chmod/chown/zip/unzip dung API co san va hien thi trang thai thanh cong/loi.
- `npm run build` frontend pass.

## Result

- Added sidebar active view state and Files view.
- Added File Manager table for roots, directory navigation, file metadata and download action.
- Added text editor with save and download controls.
- Added upload, chmod, chown, zip and unzip operation controls.
- All file API calls use `credentials: include` and reuse backend validation/RBAC.
- Verification: frontend `npm.cmd run build` passed.
- Verification: frontend `npm.cmd audit --audit-level=moderate` found 0 vulnerabilities.
- Browser verification: unauthenticated app still rendered the sign-in screen cleanly and reported no console errors.
