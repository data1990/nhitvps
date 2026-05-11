import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { AuthService, AuthorizationService, createPermissionGuard, type AuthRepository } from "../../auth/index.js";
import { SystemMetricsService, type SystemMetricsOptions } from "../application/system-metrics.service.js";

export async function registerMonitoringRoutes(
  app: FastifyInstance,
  input: {
    authRepository: AuthRepository;
    metricsOptions?: Partial<SystemMetricsOptions>;
  },
): Promise<void> {
  const authService = new AuthService(input.authRepository);
  const authorizationService = new AuthorizationService(input.authRepository);
  const monitoringReadGuard = createPermissionGuard({
    authService,
    authorizationService,
    permission: "monitoring:read",
  });
  const metricsService = new SystemMetricsService(input.metricsOptions);

  app.get("/monitoring/system", { preHandler: monitoringReadGuard }, async () => await metricsService.snapshot());

  app.get<{ Querystring: { intervalMs?: string } }>(
    "/monitoring/system/stream",
    { websocket: true, preValidation: monitoringReadGuard },
    (socket, request) => {
      const intervalMs = clampMetricsIntervalMs(request.query.intervalMs);

      const sendSnapshot = async () => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          socket.send(
            JSON.stringify({
              type: "system_metrics",
              data: await metricsService.snapshot(),
            }),
          );
        } catch (error) {
          socket.send(
            JSON.stringify({
              type: "error",
              error: {
                code: "MONITORING_STREAM_ERROR",
                message: error instanceof Error ? error.message : "Failed to stream metrics",
              },
            }),
          );
        }
      };

      const timer = setInterval(() => {
        void sendSnapshot();
      }, intervalMs);

      socket.once("close", () => {
        clearInterval(timer);
      });

      void sendSnapshot();
    },
  );
}

export function clampMetricsIntervalMs(value: string | undefined): number {
  const parsed = Number(value ?? 5_000);

  if (!Number.isFinite(parsed)) {
    return 5_000;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1_000), 60_000);
}
