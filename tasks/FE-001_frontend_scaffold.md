# FE-001: Frontend scaffold

## Metadata

- ID: FE-001
- Tên: Frontend scaffold
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: DOC-001

## Mô tả

Tạo frontend React + TailwindCSS cho dashboard quản trị VPS. Màn hình đầu tiên phải là app shell thật, có điều hướng module, trạng thái API và bố cục phù hợp công cụ vận hành, không phải landing page.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FE-001.1 | Vite React scaffold | Tạo cấu trúc frontend TypeScript | DOC-001 | P1 | DONE |
| FE-001.2 | Tailwind setup | Cấu hình TailwindCSS và base styles | FE-001.1 | P1 | DONE |
| FE-001.3 | Dashboard shell | Sidebar, topbar, status cards và module grid | FE-001.2 | P1 | DONE |
| FE-001.4 | API status client | Gọi `/api/v1/ready` và hiển thị trạng thái | FE-001.3 | P1 | DONE |
| FE-001.5 | Build verification | Build frontend pass | FE-001.4 | P1 | DONE |

## Acceptance Criteria

- Có thư mục `/frontend` với React TypeScript.
- TailwindCSS hoạt động.
- App shell hiển thị các module chính.
- Frontend đọc được readiness endpoint qua env `VITE_API_BASE_URL`.
- `npm run build` frontend pass.

## Result

- Added `/frontend` React TypeScript app with Vite.
- Added TailwindCSS/PostCSS setup and base styles.
- Added operational dashboard shell with sidebar, module cards, runtime status and delivery log.
- Added API readiness client using `VITE_API_BASE_URL`, defaulting to `/api/v1`.
- Updated CI workflow to build/audit frontend.
- Verification: frontend `npm run build` passed, frontend `npm audit --audit-level=moderate` found 0 vulnerabilities, backend `npm test` passed 82 tests, backend `npm run build` passed.
- Browser verification: in-app browser DOM showed dashboard and `API ready`; browser console had no errors. Screenshot capture timed out in the browser plugin.
