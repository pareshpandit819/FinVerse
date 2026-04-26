import Fastify from "fastify";
import { logger } from "@repo/shared/logger";
import { webhookRoutes } from "./routes/webhooks.js";
import { healthRoutes } from "./routes/health.js";
import { startWorkers } from "./workers/index.js";

const server = Fastify({ logger: false });

await server.register(healthRoutes);
await server.register(webhookRoutes, { prefix: "/webhooks" });

const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

await startWorkers();

await server.listen({ port, host });
logger.info({ port, host }, "Worker service started");
