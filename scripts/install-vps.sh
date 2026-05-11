#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="nhitvps"
REPO_URL="${REPO_URL:-https://github.com/data1990/nhitvps.git}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/nhitvps}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
PANEL_DOMAIN="${PANEL_DOMAIN:-}"
PANEL_EMAIL="${PANEL_EMAIL:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
INSTALL_NGINX_PROXY="${INSTALL_NGINX_PROXY:-true}"
ENABLE_SSL="${ENABLE_SSL:-auto}"
GENERATED_ADMIN_PASSWORD=""

log() {
  printf '\n[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '\n[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || die "This installer is intended for Linux VPS hosts."
  command -v apt-get >/dev/null 2>&1 || die "Only apt-based Ubuntu/Debian hosts are supported for now."
}

as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_base_packages() {
  log "Installing base packages"
  as_root apt-get update
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    openssl
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Docker Compose are already installed"
    return
  fi

  log "Installing Docker and Docker Compose plugin"
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-plugin
  as_root systemctl enable --now docker

  if [[ "${EUID}" -ne 0 ]]; then
    as_root usermod -aG docker "$USER" || true
  fi
}

prepare_source() {
  if [[ -n "$REPO_URL" ]]; then
    if [[ -d "$INSTALL_DIR/.git" ]]; then
      log "Updating source in $INSTALL_DIR"
      git -C "$INSTALL_DIR" fetch origin "$BRANCH"
      git -C "$INSTALL_DIR" checkout "$BRANCH"
      git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
    else
      log "Cloning $REPO_URL into $INSTALL_DIR"
      as_root mkdir -p "$INSTALL_DIR"
      as_root chown "$(id -u):$(id -g)" "$INSTALL_DIR"
      git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    fi
  else
    local script_dir
    script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
    INSTALL_DIR="$(cd "$script_dir/.." >/dev/null 2>&1 && pwd)"
    log "Using local source at $INSTALL_DIR"
  fi

  [[ -f "$INSTALL_DIR/docker/compose.yml" ]] || die "Missing docker/compose.yml in $INSTALL_DIR"
}

random_secret() {
  openssl rand -hex 32
}

random_password() {
  openssl rand -base64 24 | tr -d '\n'
}

configure_env() {
  local env_file="$INSTALL_DIR/docker/.env"
  local env_example="$INSTALL_DIR/docker/.env.example"

  if [[ ! -f "$env_file" ]]; then
    log "Creating docker/.env"
    cp "$env_example" "$env_file"
  else
    log "Keeping existing docker/.env"
  fi

  local cors_origin="http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}"
  if [[ -n "$PANEL_DOMAIN" ]]; then
    cors_origin="https://${PANEL_DOMAIN}"
  fi
  local secure_cookie="false"
  if [[ -n "$PANEL_DOMAIN" ]]; then
    secure_cookie="true"
  fi

  set_env "$env_file" "BACKEND_PORT" "$BACKEND_PORT"
  set_env "$env_file" "FRONTEND_PORT" "$FRONTEND_PORT"
  set_env_if_placeholder "$env_file" "SESSION_COOKIE_SECRET" "change-me-to-a-random-64-character-secret" "$(random_secret)"
  set_env_if_placeholder "$env_file" "MARIADB_ROOT_PASSWORD" "change-me-to-a-strong-database-password" "$(random_secret)"
  set_env "$env_file" "CORS_ORIGINS" "$cors_origin"
  set_env "$env_file" "SESSION_COOKIE_SECURE" "$secure_cookie"
  set_env "$env_file" "BOOTSTRAP_ADMIN_USERNAME" "$ADMIN_USERNAME"
  set_env "$env_file" "BOOTSTRAP_ADMIN_EMAIL" "$ADMIN_EMAIL"

  local current_admin_password
  current_admin_password="$(grep -E "^BOOTSTRAP_ADMIN_PASSWORD=" "$env_file" | tail -n 1 | cut -d= -f2- || true)"
  if [[ -z "$current_admin_password" || "$current_admin_password" == "change-me-to-a-strong-admin-password" ]]; then
    GENERATED_ADMIN_PASSWORD="$(random_password)"
    set_env "$env_file" "BOOTSTRAP_ADMIN_PASSWORD" "$GENERATED_ADMIN_PASSWORD"
  else
    GENERATED_ADMIN_PASSWORD="$current_admin_password"
  fi
}

set_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set_env_if_placeholder() {
  local file="$1"
  local key="$2"
  local placeholder="$3"
  local value="$4"
  local current

  current="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true)"

  if [[ -z "$current" || "$current" == "$placeholder" ]]; then
    set_env "$file" "$key" "$value"
  fi
}

start_stack() {
  log "Building and starting Docker Compose stack"
  as_root docker compose --env-file "$INSTALL_DIR/docker/.env" -f "$INSTALL_DIR/docker/compose.yml" up --build -d

  log "Waiting for backend readiness"
  for _ in $(seq 1 40); do
    if curl --fail --silent "http://127.0.0.1:${BACKEND_PORT}/api/v1/ready" >/dev/null; then
      as_root docker compose --env-file "$INSTALL_DIR/docker/.env" -f "$INSTALL_DIR/docker/compose.yml" ps
      return
    fi
    sleep 3
  done

  as_root docker compose --env-file "$INSTALL_DIR/docker/.env" -f "$INSTALL_DIR/docker/compose.yml" logs --tail=120 backend || true
  die "Backend did not become ready on port ${BACKEND_PORT}."
}

configure_nginx_proxy() {
  [[ "$INSTALL_NGINX_PROXY" == "true" ]] || return
  [[ -n "$PANEL_DOMAIN" ]] || {
    log "Skipping Nginx reverse proxy because PANEL_DOMAIN is empty"
    return
  }

  log "Installing and configuring host Nginx reverse proxy"
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y nginx

  local site_file="/etc/nginx/sites-available/${APP_NAME}.conf"
  as_root tee "$site_file" >/dev/null <<EOF
server {
    listen 80;
    server_name ${PANEL_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  as_root ln -sf "$site_file" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
  as_root nginx -t
  as_root systemctl reload nginx

  if [[ "$ENABLE_SSL" == "true" || ( "$ENABLE_SSL" == "auto" && -n "$PANEL_EMAIL" ) ]]; then
    log "Installing Certbot and requesting HTTPS certificate"
    as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
    as_root certbot --nginx -d "$PANEL_DOMAIN" --non-interactive --agree-tos -m "$PANEL_EMAIL" --redirect
  else
    log "Skipping SSL. Set PANEL_EMAIL=admin@example.com ENABLE_SSL=true to enable Certbot."
  fi
}

print_summary() {
  local url="http://127.0.0.1:${FRONTEND_PORT}"
  if [[ -n "$PANEL_DOMAIN" ]]; then
    url="https://${PANEL_DOMAIN}"
  fi

  cat <<EOF

[$APP_NAME] Installation complete.

Panel URL:
  ${url}

Admin login:
  username: ${ADMIN_USERNAME}
  email: ${ADMIN_EMAIL}
  password: ${GENERATED_ADMIN_PASSWORD}

Deployment directory:
  ${INSTALL_DIR}

Useful commands:
  docker compose --env-file ${INSTALL_DIR}/docker/.env -f ${INSTALL_DIR}/docker/compose.yml ps
  docker compose --env-file ${INSTALL_DIR}/docker/.env -f ${INSTALL_DIR}/docker/compose.yml logs -f backend
  docker compose --env-file ${INSTALL_DIR}/docker/.env -f ${INSTALL_DIR}/docker/compose.yml pull
  docker compose --env-file ${INSTALL_DIR}/docker/.env -f ${INSTALL_DIR}/docker/compose.yml up --build -d

EOF
}

main() {
  require_linux
  install_base_packages
  install_docker
  prepare_source
  configure_env
  start_stack
  configure_nginx_proxy
  print_summary
}

main "$@"
