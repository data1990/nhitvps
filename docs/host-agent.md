# NhiTVPS Host Agent Design

## Goal

The host agent isolates privileged host operations from the web backend. The backend remains an unprivileged API process, while the agent owns tightly scoped adapters for Nginx, Certbot, UFW and selected system commands.

## Process Boundary

```text
Frontend
  -> Backend Fastify API
    -> Host Agent RPC over local Unix socket or Windows named pipe
      -> allowlisted privileged adapters
```

The agent must run on the VPS host with the smallest OS privilege set that can perform the configured tasks. In container deployments, the backend container must not mount the Docker socket or run privileged by default.

## Transport

- Prefer Unix domain socket on Linux: `/run/nhitvps-agent/agent.sock`.
- Windows development may use named pipe or localhost TCP bound to `127.0.0.1`.
- The socket directory must be owned by the agent user/group and not world-writable.
- Every request must include backend identity, request id and actor id.
- Every response must include operation id, status and structured error if failed.

## Authentication

- Use mTLS or signed request tokens for backend-to-agent calls.
- Rotate agent shared credentials separately from user session cookies.
- Never forward user session cookies to the agent.
- The backend translates user RBAC into agent operation requests.

## Operation Contract

```ts
type HostAgentRequest = {
  requestId: string;
  actorUserId: string;
  operation:
    | "nginx.test"
    | "nginx.reload"
    | "nginx.restart"
    | "certbot.issue"
    | "firewall.status"
    | "firewall.apply"
    | "database.backup"
    | "database.restore";
  payload: Record<string, unknown>;
  createdAt: string;
};
```

Rules:

- Payload must be schema-validated by backend and agent.
- Agent maps operations to allowlisted adapters only.
- No arbitrary shell strings.
- Commands use argument arrays, timeout and output caps.
- Agent returns redacted stdout/stderr.

## Safety Controls

- Deny by default for unknown operations.
- Require `nginx -t` before reload/restart.
- Backup config before overwriting Nginx files.
- Firewall apply must support rollback when partially applied.
- Certbot must reject wildcard domains unless explicitly implemented later.
- Database credentials must not appear in command args, logs or audit output.
- Agent must clamp task concurrency per operation type.

## Audit

Agent writes append-only audit events:

- request id
- actor user id
- operation
- normalized target
- policy id
- start/end timestamp
- result
- redacted error summary

The backend also records high-level audit events, but the agent audit is the source of truth for privileged host effects.

## Deployment

- Package agent as a separate systemd service: `nhitvps-agent.service`.
- Backend talks to agent socket through a dedicated group such as `nhitvps-agent`.
- Default Docker compose must keep the agent disabled unless the host operator installs it.
- Production setup should document exact sudoers or service permissions instead of granting broad root shell access.

## Migration Path

1. Keep current in-process adapters for development and tests.
2. Add a `HostAgentClient` implementing the same command executor interfaces.
3. Gate usage by env, for example `HOST_AGENT_ENABLED=true`.
4. Move Nginx runtime, Certbot and UFW execution behind the client first.
5. Move database backup/restore command execution after credential handling is verified.
6. Remove direct privileged command policies from backend production deployment.
