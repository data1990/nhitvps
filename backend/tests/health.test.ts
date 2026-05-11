import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AppError } from "../src/shared/errors/app-error.js";

describe("health routes", () => {
  it("returns health status", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "nhitvps-backend",
    });
  });

  it("returns readiness status", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ready",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      checks: {
        config: "ok",
      },
    });
  });

  it("returns normalized not found errors", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/missing",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.json()).toMatchObject({
      error: {
        code: "ROUTE_NOT_FOUND",
        requestId: response.headers["x-request-id"],
      },
    });
  });

  it("returns normalized application errors", async () => {
    const app = await buildApp();

    app.get("/api/v1/test-error", async () => {
      throw new AppError({
        code: "CONFIG_ERROR",
        message: "Invalid test config",
        statusCode: 409,
        details: {
          field: "example",
        },
      });
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/test-error",
      headers: {
        "x-request-id": "test-request-id",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.headers["x-request-id"]).toBe("test-request-id");
    expect(response.json()).toMatchObject({
      error: {
        code: "CONFIG_ERROR",
        message: "Invalid test config",
        requestId: "test-request-id",
        details: {
          field: "example",
        },
      },
    });
  });
});
