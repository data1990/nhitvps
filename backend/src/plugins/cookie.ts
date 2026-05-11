import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function registerCookiePlugin(app: FastifyInstance): Promise<void> {
  await app.register(cookie, {
    secret: env.SESSION_COOKIE_SECRET,
    hook: "onRequest",
  });
}

