# API Documentation

The backend serves the OpenAPI document at:

```text
GET /api/v1/docs/openapi.json
```

Local URL:

```text
http://127.0.0.1:8080/api/v1/docs/openapi.json
```

Authentication uses an httpOnly session cookie named `nhitvps_session`. Protected routes also require RBAC permissions, documented through the `x-required-permissions` extension in the OpenAPI document.

The current document covers:

- Health and readiness
- Auth session APIs
- File manager APIs
- Nginx vhost/runtime/SSL APIs
- Database provisioning and backup/restore APIs
- Firewall status/apply APIs
- System monitoring HTTP and WebSocket APIs
