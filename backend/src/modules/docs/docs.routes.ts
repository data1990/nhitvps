import type { FastifyInstance } from "fastify";
import { openApiDocument } from "./openapi.js";

export async function registerDocsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/docs/openapi.json", async () => openApiDocument);
}
