import { describe, expect, it } from "vitest";
import { renderNginxVhost } from "../src/modules/nginx/index.js";

describe("nginx vhost renderer", () => {
  it("renders static site configs from validated model", () => {
    const rendered = renderNginxVhost({
      id: "site-1",
      domain: "example.com",
      aliases: ["www.example.com"],
      mode: "static",
      documentRoot: "/var/www/example.com/public",
      sslMode: "none",
      accessLogPath: "/var/log/nginx/example.com.access.log",
      errorLogPath: "/var/log/nginx/example.com.error.log",
      enabled: true,
    });

    expect(rendered.fileName).toBe("example.com.conf");
    expect(rendered.content).toContain("server_name example.com www.example.com;");
    expect(rendered.content).toContain("root /var/www/example.com/public;");
    expect(rendered.content).toContain("try_files $uri $uri/ =404;");
  });

  it("renders reverse proxy configs from validated model", () => {
    const rendered = renderNginxVhost({
      id: "site-2",
      domain: "api.example.com",
      aliases: [],
      mode: "reverse_proxy",
      upstreamUrl: "http://127.0.0.1:3000/",
      sslMode: "none",
      accessLogPath: "/var/log/nginx/api.example.com.access.log",
      errorLogPath: "/var/log/nginx/api.example.com.error.log",
      enabled: true,
    });

    expect(rendered.content).toContain("proxy_pass http://127.0.0.1:3000;");
    expect(rendered.content).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
  });

  it("rejects unsafe domain and upstream values", () => {
    expect(() =>
      renderNginxVhost({
        id: "site-3",
        domain: "example.com;\ninclude /etc/passwd",
        aliases: [],
        mode: "static",
        documentRoot: "/var/www/example.com/public",
        sslMode: "none",
        accessLogPath: "/var/log/nginx/example.com.access.log",
        errorLogPath: "/var/log/nginx/example.com.error.log",
        enabled: true,
      }),
    ).toThrowError("domain contains unsafe characters");

    expect(() =>
      renderNginxVhost({
        id: "site-4",
        domain: "api.example.com",
        aliases: [],
        mode: "reverse_proxy",
        upstreamUrl: "file:///etc/passwd",
        sslMode: "none",
        accessLogPath: "/var/log/nginx/api.example.com.access.log",
        errorLogPath: "/var/log/nginx/api.example.com.error.log",
        enabled: true,
      }),
    ).toThrowError("Upstream URL must use http or https");
  });
});

