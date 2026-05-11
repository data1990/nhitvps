# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl default-mysql-client dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nhitvps \
  && useradd --system --gid nhitvps --home-dir /app/backend --shell /usr/sbin/nologin nhitvps \
  && mkdir -p \
    /var/lib/nhitvps/backups/databases \
    /var/www \
    /etc/nginx/sites-available \
    /etc/nginx/sites-enabled \
    /var/log/nginx \
  && chown -R nhitvps:nhitvps \
    /app \
    /var/lib/nhitvps \
    /var/www \
    /etc/nginx/sites-available \
    /etc/nginx/sites-enabled \
    /var/log/nginx

COPY --from=build --chown=nhitvps:nhitvps /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build --chown=nhitvps:nhitvps /app/backend/node_modules ./node_modules
COPY --from=build --chown=nhitvps:nhitvps /app/backend/dist ./dist

USER nhitvps
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8080/api/v1/ready >/dev/null || exit 1

CMD ["dumb-init", "node", "dist/server.js"]
