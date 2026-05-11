import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    service: "nhitvps-backend",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async () => ({
    status: "ready",
    checks: {
      config: "ok",
    },
    timestamp: new Date().toISOString(),
  }));
}

