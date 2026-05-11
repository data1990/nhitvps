# NhiTVPS

Mini VPS control panel with Fastify backend, React frontend, MariaDB, Nginx/database/firewall operations, monitoring and guarded system package setup.

## Push to GitHub

Create an empty GitHub repository first, then run from this project root:

```bash
REPO_URL=https://github.com/data1990/nhitvps.git ./scripts/push-github.sh
```

On Windows PowerShell, use Git Bash or WSL for the `.sh` script, or run the equivalent commands:

```bash
git init
git branch -M main
git remote add origin https://github.com/data1990/nhitvps.git
git add .
git commit -m "Initial NhiTVPS source"
git push -u origin main
```

## Install on a VPS

Recommended Ubuntu/Debian install using Docker Compose:

```bash
curl -fsSL https://raw.githubusercontent.com/data1990/nhitvps/main/scripts/install-vps.sh -o install-vps.sh
chmod +x install-vps.sh
PANEL_DOMAIN=panel.example.com \
PANEL_EMAIL=admin@example.com \
./install-vps.sh
```

Without a domain, it installs the panel frontend on port `3000` and backend API on port `8080`:

```bash
./install-vps.sh
```

The installer creates `docker/.env`, generates secrets, installs Docker if needed, starts the Compose stack and optionally configures host Nginx + Certbot when `PANEL_DOMAIN` and `PANEL_EMAIL` are set.
It also creates a bootstrap admin from `ADMIN_USERNAME` and `ADMIN_EMAIL` and prints the generated password at the end.

## Useful Commands

```bash
cd /opt/nhitvps
docker compose --env-file docker/.env -f docker/compose.yml ps
docker compose --env-file docker/.env -f docker/compose.yml logs -f backend
docker compose --env-file docker/.env -f docker/compose.yml up --build -d
```

## Security Note

The default Docker deployment keeps the backend unprivileged. Host-level package installation and host service control should be used carefully on a real VPS, ideally through a reviewed host-agent or a direct host deployment profile.
