import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("docs routes", () => {
  it("serves the OpenAPI document without requiring authentication", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/docs/openapi.json",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.components.securitySchemes.sessionCookie).toMatchObject({
      type: "apiKey",
      in: "cookie",
    });
    expect(body.paths["/auth/login"].post).toBeDefined();
    expect(body.paths["/monitoring/system/stream"].get["x-required-permissions"]).toEqual(["monitoring:read"]);
  });
});
