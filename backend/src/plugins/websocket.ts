import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";

export async function registerWebSocketPlugin(app: FastifyInstance): Promise<void> {
  await app.register(websocket);
}
