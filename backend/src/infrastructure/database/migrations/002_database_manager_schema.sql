-- NhiTVPS DB-001
-- MariaDB/MySQL database manager metadata schema.
-- This schema stores control-plane metadata only. It never stores plaintext database passwords.

CREATE TABLE IF NOT EXISTS managed_databases (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  engine ENUM('mysql', 'mariadb') NOT NULL,
  charset_name VARCHAR(32) NOT NULL DEFAULT 'utf8mb4',
  collation_name VARCHAR(64) NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  owner_user_id CHAR(36) NULL,
  status ENUM('active', 'disabled', 'pending_delete') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uq_managed_databases_name (name),
  KEY idx_managed_databases_engine (engine),
  KEY idx_managed_databases_owner_user_id (owner_user_id),
  KEY idx_managed_databases_status (status),
  KEY idx_managed_databases_deleted_at (deleted_at),
  CONSTRAINT fk_managed_databases_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS managed_database_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  host VARCHAR(255) NOT NULL DEFAULT 'localhost',
  auth_plugin ENUM('caching_sha2_password', 'ed25519', 'mysql_native_password', 'unix_socket') NOT NULL,
  password_secret_ref VARCHAR(255) NULL,
  status ENUM('active', 'locked', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uq_managed_database_users_username_host (username, host),
  KEY idx_managed_database_users_status (status),
  KEY idx_managed_database_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS managed_database_grants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  database_id CHAR(36) NOT NULL,
  database_user_id CHAR(36) NOT NULL,
  privileges_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_managed_database_grants_database_user (database_id, database_user_id),
  KEY idx_managed_database_grants_database_id (database_id),
  KEY idx_managed_database_grants_database_user_id (database_user_id),
  CONSTRAINT fk_managed_database_grants_database
    FOREIGN KEY (database_id) REFERENCES managed_databases (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_managed_database_grants_database_user
    FOREIGN KEY (database_user_id) REFERENCES managed_database_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS database_backups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  database_id CHAR(36) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  status ENUM('created', 'failed', 'restored', 'verified') NOT NULL DEFAULT 'created',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  verified_at DATETIME(3) NULL,
  UNIQUE KEY uq_database_backups_checksum (checksum_sha256),
  KEY idx_database_backups_database_id (database_id),
  KEY idx_database_backups_status (status),
  KEY idx_database_backups_created_at (created_at),
  CONSTRAINT fk_database_backups_database
    FOREIGN KEY (database_id) REFERENCES managed_databases (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS database_slow_query_settings (
  database_id CHAR(36) NOT NULL PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  long_query_time_ms INT UNSIGNED NOT NULL DEFAULT 1000,
  log_output ENUM('file', 'table') NOT NULL DEFAULT 'file',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_database_slow_query_settings_database
    FOREIGN KEY (database_id) REFERENCES managed_databases (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
