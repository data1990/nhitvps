# NhiTVPS Docker Deployment

## Files

- `backend.Dockerfile`: production multi-stage image for the Fastify backend.
- `frontend.Dockerfile`: production React build served by Nginx.
- `nginx.frontend.conf`: frontend Nginx config with `/api/` proxy to the backend container.
- `compose.yml`: frontend, backend and MariaDB with persistent volumes and healthchecks.
- `.env.example`: deployment variables. Copy it to `.env` and replace every secret before running.

## Run

```bash
cd docker
cp .env.example .env
docker compose -f compose.yml up --build -d
docker compose -f compose.yml ps
curl http://127.0.0.1:8080/api/v1/ready
curl http://127.0.0.1:3000/
```

## Automated VPS Install

After pushing the source to GitHub, run this on an Ubuntu/Debian VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/<user>/<repo>/main/scripts/install-vps.sh -o install-vps.sh
chmod +x install-vps.sh
REPO_URL=https://github.com/<user>/<repo>.git \
PANEL_DOMAIN=panel.example.com \
PANEL_EMAIL=admin@example.com \
./install-vps.sh
```

Set `PANEL_DOMAIN` and `PANEL_EMAIL` only when DNS already points to the VPS. Without them, the installer starts the panel frontend on `http://127.0.0.1:3000` and the backend API on `http://127.0.0.1:8080`.
The installer writes bootstrap admin credentials into `docker/.env` and prints the generated password once installation completes.

Validate the compose file without copying `.env`:

```bash
NHITVPS_ENV_FILE=./.env.example docker compose --env-file .env.example -f compose.yml config
```

## Rollback

```bash
cd docker
docker compose -f compose.yml pull
docker compose -f compose.yml up -d --no-build backend
```

For local images, retag the last known good image before upgrading:

```bash
docker tag nhitvps/backend:local nhitvps/backend:rollback
docker compose -f compose.yml build backend
docker compose -f compose.yml up -d backend
```

Rollback to the tagged image:

```bash
docker tag nhitvps/backend:rollback nhitvps/backend:local
docker compose -f compose.yml up -d --no-build backend
```

## Security Notes

- The backend container runs as the `nhitvps` system user, not root.
- The default compose file does not mount the host Docker socket and does not run privileged.
- Host-level actions such as UFW, system Nginx reload, Certbot on the host, and process control need a future dedicated host-agent or an explicitly reviewed privileged deployment profile.
- Keep `SESSION_COOKIE_SECRET` and `MARIADB_ROOT_PASSWORD` out of git and rotate them if exposed.
- Use HTTPS at the reverse proxy layer before exposing the panel outside localhost.
