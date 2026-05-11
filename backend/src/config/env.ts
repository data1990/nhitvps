import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(120),
  RATE_LIMIT_WINDOW: z.string().min(1).default("1 minute"),
  SESSION_COOKIE_NAME: z.string().min(1).default("nhitvps_session"),
  SESSION_COOKIE_SECRET: z.string().min(32).default("dev-only-cookie-secret-change-me-please"),
  SESSION_COOKIE_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(60 * 24 * 30).default(60 * 12),
  BOOTSTRAP_ADMIN_USERNAME: z.string().default(""),
  BOOTSTRAP_ADMIN_EMAIL: z.string().default(""),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().default(""),
  FILE_MANAGER_ROOTS: z
    .string()
    .default(process.cwd())
    .transform((value) =>
      value
        .split(",")
        .map((root) => root.trim())
        .filter(Boolean),
    ),
  FILE_MANAGER_MAX_READ_BYTES: z.coerce.number().int().min(1).max(20 * 1024 * 1024).default(1024 * 1024),
  FILE_MANAGER_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(200 * 1024 * 1024).default(20 * 1024 * 1024),
  FILE_MANAGER_MAX_WRITE_BYTES: z.coerce.number().int().min(1).max(20 * 1024 * 1024).default(1024 * 1024),
  FILE_MANAGER_MAX_ARCHIVE_BYTES: z.coerce.number().int().min(1).max(1024 * 1024 * 1024).default(200 * 1024 * 1024),
  NGINX_SITES_AVAILABLE_DIR: z.string().min(1).default("C:/nginx/sites-available"),
  NGINX_SITES_ENABLED_DIR: z.string().min(1).default("C:/nginx/sites-enabled"),
  NGINX_BACKUP_DIR: z.string().min(1).default("C:/nginx/backups"),
  NGINX_LOG_DIR: z.string().min(1).default("C:/nginx/logs"),
  NGINX_BINARY: z.string().min(1).default("nginx"),
  SYSTEMCTL_BINARY: z.string().min(1).default("systemctl"),
  CERTBOT_BINARY: z.string().min(1).default("certbot"),
  MYSQL_HOST: z.string().min(1).default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_ADMIN_USER: z.string().min(1).default("root"),
  MYSQL_ADMIN_PASSWORD: z.string().default(""),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(5),
  MYSQLDUMP_BINARY: z.string().min(1).default("mysqldump"),
  MYSQL_CLIENT_BINARY: z.string().min(1).default("mysql"),
  DATABASE_BACKUP_DIR: z.string().min(1).default("C:/nhitvps/backups/databases"),
  DATABASE_BACKUP_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60 * 60 * 1000).default(10 * 60 * 1000),
  DATABASE_RESTORE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60 * 60 * 1000).default(10 * 60 * 1000),
  DATABASE_BACKUP_MAX_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024 * 1024).default(256 * 1024 * 1024),
  AUTO_BACKUP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  AUTO_BACKUP_DATABASES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((database) => database.trim())
        .filter(Boolean),
    ),
  AUTO_BACKUP_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(60 * 24 * 7).default(60 * 24),
  AUTO_BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  AUTO_BACKUP_DIR: z.string().min(1).default("C:/nhitvps/backups/auto"),
  UFW_BINARY: z.string().min(1).default("ufw"),
  APT_GET_BINARY: z.string().min(1).default("apt-get"),
  DPKG_BINARY: z.string().min(1).default("dpkg"),
  MONITOR_DISK_PATHS: z
    .string()
    .default(process.cwd())
    .transform((value) =>
      value
        .split(",")
        .map((diskPath) => diskPath.trim())
        .filter(Boolean),
    ),
  DOCKER_SOCKET_PATH: z.string().min(1).default("/var/run/docker.sock"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

if (parsedEnv.data.NODE_ENV === "production" && parsedEnv.data.CORS_ORIGINS.includes("*")) {
  throw new Error("CORS_ORIGINS cannot include '*' in production");
}

if (
  parsedEnv.data.NODE_ENV === "production" &&
  parsedEnv.data.SESSION_COOKIE_SECRET === "dev-only-cookie-secret-change-me-please"
) {
  throw new Error("SESSION_COOKIE_SECRET must be changed in production");
}

export const env = Object.freeze(parsedEnv.data);
export type AppEnv = typeof env;
