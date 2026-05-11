import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
} catch (error) {
  app.log.fatal({ err: error }, "failed to start server");
  process.exit(1);
}

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, "shutting down server");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

