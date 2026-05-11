import path from "node:path";
import type { NginxSiteConfig, RenderedNginxVhost } from "../domain/nginx.types.js";
import { validateNginxSiteConfig } from "../domain/nginx.validators.js";

export function renderNginxVhost(config: NginxSiteConfig): RenderedNginxVhost {
  const safeConfig = validateNginxSiteConfig(config);
  const serverNames = [safeConfig.domain, ...safeConfig.aliases].join(" ");
  const body =
    safeConfig.mode === "reverse_proxy"
      ? renderReverseProxyLocation(safeConfig.upstreamUrl!)
      : renderStaticLocation(safeConfig.documentRoot!);

  return {
    fileName: `${safeConfig.domain}.conf`,
    content: [
      "server {",
      "    listen 80;",
      `    server_name ${serverNames};`,
      "",
      `    access_log ${safeConfig.accessLogPath};`,
      `    error_log ${safeConfig.errorLogPath};`,
      "",
      ...body,
      "}",
      "",
    ].join("\n"),
  };
}

function renderStaticLocation(documentRoot: string): string[] {
  return [
    `    root ${documentRoot};`,
    "    index index.html index.htm index.php;",
    "",
    "    location / {",
    "        try_files $uri $uri/ =404;",
    "    }",
  ];
}

function renderReverseProxyLocation(upstreamUrl: string): string[] {
  const normalizedUrl = normalizeUpstreamUrl(upstreamUrl);

  return [
    "    location / {",
    `        proxy_pass ${normalizedUrl};`,
    "        proxy_http_version 1.1;",
    "        proxy_set_header Host $host;",
    "        proxy_set_header X-Real-IP $remote_addr;",
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "        proxy_set_header X-Forwarded-Proto $scheme;",
    "    }",
  ];
}

function normalizeUpstreamUrl(upstreamUrl: string): string {
  const url = new URL(upstreamUrl);
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.protocol}//${url.host}${pathname}`;
}

export function createNginxLogPaths(domain: string, baseDirectory: string): { accessLogPath: string; errorLogPath: string } {
  return {
    accessLogPath: path.join(baseDirectory, `${domain}.access.log`),
    errorLogPath: path.join(baseDirectory, `${domain}.error.log`),
  };
}

