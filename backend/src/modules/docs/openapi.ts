export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "NhiTVPS API",
    version: "0.1.0",
    description: "API for the NhiTVPS mini VPS control panel.",
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current API version",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "File Manager" },
    { name: "Nginx" },
    { name: "Database" },
    { name: "Firewall" },
    { name: "Monitoring" },
    { name: "System" },
    { name: "Docs" },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "nhitvps_session",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              details: {},
            },
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["identifier", "password"],
        properties: {
          identifier: { type: "string", minLength: 1, maxLength: 255 },
          password: { type: "string", minLength: 8, maxLength: 1024 },
        },
      },
      FilePathRequest: {
        type: "object",
        required: ["path"],
        properties: {
          root: { type: "string" },
          path: { type: "string", minLength: 1 },
        },
      },
      NginxSiteRequest: {
        type: "object",
        required: ["id", "domain", "mode", "accessLogPath", "errorLogPath"],
        properties: {
          id: { type: "string" },
          domain: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, default: [] },
          mode: { type: "string", enum: ["static", "reverse_proxy"] },
          documentRoot: { type: "string" },
          upstreamUrl: { type: "string" },
          sslMode: { type: "string", enum: ["none", "lets_encrypt", "custom"], default: "none" },
          accessLogPath: { type: "string" },
          errorLogPath: { type: "string" },
          enabled: { type: "boolean", default: true },
        },
      },
      LetsEncryptRequest: {
        type: "object",
        required: ["domain", "email"],
        properties: {
          domain: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          email: { type: "string", format: "email" },
          redirect: { type: "boolean" },
          staging: { type: "boolean" },
        },
      },
      DatabaseRequest: {
        type: "object",
        required: ["name"],
        properties: {
          id: { type: "string" },
          name: { type: "string", maxLength: 64 },
          charset: { type: "string", enum: ["utf8mb4"], default: "utf8mb4" },
          collation: {
            type: "string",
            enum: ["utf8mb4_unicode_ci", "utf8mb4_general_ci", "utf8mb4_0900_ai_ci"],
            default: "utf8mb4_unicode_ci",
          },
          ownerUserId: { type: ["string", "null"] },
        },
      },
      DatabaseUserRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          id: { type: "string" },
          username: { type: "string", maxLength: 32 },
          host: { type: "string", maxLength: 255, default: "localhost" },
          password: { type: "string", minLength: 16, maxLength: 256 },
        },
      },
      FirewallRuleRequest: {
        type: "object",
        required: ["id", "name", "type", "action", "targets"],
        properties: {
          id: { type: "string" },
          name: { type: "string", maxLength: 120 },
          type: {
            type: "string",
            enum: ["blacklist", "whitelist", "rate_limit", "geo_block", "ssh_protection", "ddos_protection", "botnet_block"],
          },
          action: { type: "string", enum: ["allow", "deny", "limit", "log"] },
          direction: { type: "string", enum: ["inbound", "outbound"], default: "inbound" },
          protocol: { type: "string", enum: ["tcp", "udp", "icmp", "all"], default: "tcp" },
          targets: {
            type: "array",
            minItems: 1,
            items: {
              oneOf: [
                {
                  type: "object",
                  required: ["kind", "value"],
                  properties: { kind: { type: "string", enum: ["ip", "cidr", "country"] }, value: { type: "string" } },
                },
                {
                  type: "object",
                  required: ["kind", "value"],
                  properties: { kind: { type: "string", enum: ["port"] }, value: { type: "integer" } },
                },
                {
                  type: "object",
                  required: ["kind", "from", "to"],
                  properties: { kind: { type: "string", enum: ["port_range"] }, from: { type: "integer" }, to: { type: "integer" } },
                },
              ],
            },
          },
          ports: {
            type: "array",
            items: {
              oneOf: [
                { type: "integer" },
                {
                  type: "object",
                  required: ["from", "to"],
                  properties: { from: { type: "integer" }, to: { type: "integer" } },
                },
              ],
            },
          },
          priority: { type: "integer", default: 1000 },
          status: { type: "string", enum: ["enabled", "disabled", "pending_apply", "failed"], default: "pending_apply" },
          description: { type: "string", maxLength: 500 },
        },
      },
      SystemPackageInstallRequest: {
        type: "object",
        required: ["component"],
        properties: {
          component: { type: "string", enum: ["certbot", "mariadb", "mysql", "nginx", "ufw"] },
          startService: { type: "boolean", default: true },
        },
      },
      SystemPackageInstallStackRequest: {
        type: "object",
        properties: {
          components: {
            type: "array",
            minItems: 1,
            default: ["nginx", "mysql", "ufw", "certbot"],
            items: { type: "string", enum: ["certbot", "mariadb", "mysql", "nginx", "ufw"] },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication is required.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      Forbidden: {
        description: "Permission denied.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      ValidationError: {
        description: "Request validation failed.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: { "200": { description: "Service is alive." } },
      },
    },
    "/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness check",
        responses: { "200": { description: "Service is ready." } },
      },
    },
    "/docs/openapi.json": {
      get: {
        tags: ["Docs"],
        summary: "OpenAPI JSON document",
        responses: { "200": { description: "OpenAPI document." } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Create session",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          "200": { description: "Session created. Sets an httpOnly session cookie." },
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/logout": protectedOperation("Auth", "Revoke current session", "post"),
    "/auth/me": protectedOperation("Auth", "Return current session user", "get"),
    "/files/roots": protectedOperation("File Manager", "List allowed file manager roots", "get", ["file:read"]),
    "/files/list": protectedOperation("File Manager", "List directory content", "get", ["file:read"]),
    "/files/read": protectedOperation("File Manager", "Read text file", "get", ["file:read"]),
    "/files/download": protectedOperation("File Manager", "Download file", "get", ["file:read"]),
    "/files/upload": protectedOperation("File Manager", "Upload file using multipart form-data", "post", ["file:update"]),
    "/files/write": requestOperation("File Manager", "Write text file", "post", "#/components/schemas/FilePathRequest", ["file:update"]),
    "/files/chmod": protectedOperation("File Manager", "Change file mode", "post", ["file:update"]),
    "/files/chown": protectedOperation("File Manager", "Change file owner", "post", ["file:update"]),
    "/files/zip": protectedOperation("File Manager", "Create zip archive", "post", ["file:update"]),
    "/files/unzip": protectedOperation("File Manager", "Extract zip archive", "post", ["file:update"]),
    "/nginx/sites": requestOperation("Nginx", "Create or update Nginx vhost", "post", "#/components/schemas/NginxSiteRequest", ["nginx:update"]),
    "/nginx/test": protectedOperation("Nginx", "Run nginx config test", "post", ["nginx:execute"]),
    "/nginx/reload": protectedOperation("Nginx", "Reload Nginx after config test", "post", ["nginx:execute"]),
    "/nginx/restart": protectedOperation("Nginx", "Restart Nginx after config test", "post", ["nginx:execute"]),
    "/nginx/ssl/lets-encrypt": requestOperation(
      "Nginx",
      "Issue Let's Encrypt certificate through Certbot",
      "post",
      "#/components/schemas/LetsEncryptRequest",
      ["nginx:update"],
    ),
    "/databases": requestOperation("Database", "Create database", "post", "#/components/schemas/DatabaseRequest", ["database:create"]),
    "/databases/users": requestOperation(
      "Database",
      "Create database user",
      "post",
      "#/components/schemas/DatabaseUserRequest",
      ["database:create"],
    ),
    "/databases/grants": protectedOperation("Database", "Grant database privileges", "post", ["database:create"]),
    "/databases/provision": protectedOperation("Database", "Create database, user and grants together", "post", ["database:create"]),
    "/databases/backups": protectedOperation("Database", "Backup database", "post", ["backup:create"]),
    "/databases/restore": protectedOperation("Database", "Restore database backup", "post", ["database:restore"]),
    "/firewall/status": protectedOperation("Firewall", "Read firewall status", "get", ["firewall:read"]),
    "/firewall/rules/apply": requestOperation(
      "Firewall",
      "Apply firewall rule with rollback support",
      "post",
      "#/components/schemas/FirewallRuleRequest",
      ["firewall:update"],
    ),
    "/monitoring/system": protectedOperation("Monitoring", "Read system metrics snapshot", "get", ["monitoring:read"]),
    "/monitoring/system/stream": {
      get: {
        tags: ["Monitoring"],
        summary: "Stream system metrics over WebSocket",
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: "intervalMs",
            in: "query",
            schema: { type: "integer", minimum: 1000, maximum: 60000, default: 5000 },
          },
        ],
        responses: {
          "101": { description: "WebSocket upgrade. Messages are JSON events with type `system_metrics`." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
        "x-required-permissions": ["monitoring:read"],
      },
    },
    "/system/packages/status": protectedOperation("System", "Read host package install status", "get", ["system:manage"]),
    "/system/packages/install": requestOperation(
      "System",
      "Install a host package component",
      "post",
      "#/components/schemas/SystemPackageInstallRequest",
      ["system:manage"],
    ),
    "/system/packages/install-stack": requestOperation(
      "System",
      "Install a stack of host package components",
      "post",
      "#/components/schemas/SystemPackageInstallStackRequest",
      ["system:manage"],
    ),
  },
} as const;

type HttpMethod = "get" | "post";

function protectedOperation(tag: string, summary: string, method: HttpMethod, permissions: string[] = []) {
  return {
    [method]: {
      tags: [tag],
      summary,
      security: [{ sessionCookie: [] }],
      responses: {
        "200": { description: "Successful response." },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
      },
      ...(permissions.length > 0 ? { "x-required-permissions": permissions } : {}),
    },
  };
}

function requestOperation(tag: string, summary: string, method: HttpMethod, schemaRef: string, permissions: string[]) {
  return {
    [method]: {
      tags: [tag],
      summary,
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: schemaRef } } },
      },
      responses: {
        "200": { description: "Successful response." },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
      },
      "x-required-permissions": permissions,
    },
  };
}
