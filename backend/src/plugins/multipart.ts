import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function registerMultipartPlugin(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: env.FILE_MANAGER_MAX_UPLOAD_BYTES,
      files: 1,
      fields: 8,
    },
  });
}

