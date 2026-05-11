# DB-002: Create database/user

## Metadata

- ID: DB-002
- Tên: Create database/user
- Ưu tiên: P1
- Trạng thái: DONE
- Dependency: DB-001

## Mô tả

Tạo service và API để tạo database, tạo database user, và gán quyền cơ bản trên MySQL/MariaDB. Dữ liệu động phải đi qua parameterized SQL; identifier phải validate trước khi quote.

## Subtasks

| ID | Tên | Mô tả | Dependency | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| DB-002.1 | MySQL adapter | Tạo adapter thực thi SQL qua pool/connection | DB-001 | P1 | DONE |
| DB-002.2 | Provision service | Tạo database/user/grant với transaction-safe sequence | DB-002.1 | P1 | DONE |
| DB-002.3 | Routes | API protected by `database:create` | AUTH-003 | P1 | DONE |
| DB-002.4 | Tests | Test SQL order, validation, RBAC | DB-002.3 | P1 | DONE |

## Acceptance Criteria

- Không dùng shell để thao tác MySQL/MariaDB.
- Tên database/user/host/privilege phải validate trước khi sinh SQL.
- Password chỉ đi qua parameterized SQL, không log plaintext.
- Route yêu cầu session và permission `database:create`.
- Test pass.

## Result

- Added MySQL/MariaDB SQL executor using `mysql2` pool with `multipleStatements: false`.
- Added database provisioning service for create database, create user, grant privileges, and combined provisioning.
- Added rollback compensation for partially created database/user when later provisioning steps fail.
- Added protected APIs:
  - `POST /api/v1/databases`
  - `POST /api/v1/databases/users`
  - `POST /api/v1/databases/grants`
  - `POST /api/v1/databases/provision`
- Added env config for MySQL admin connection.
- Verification:
  - `npm.cmd test`: PASS, 60 tests.
  - `npm.cmd run build`: PASS.
  - `npm.cmd audit --audit-level=moderate`: PASS, 0 vulnerabilities.
