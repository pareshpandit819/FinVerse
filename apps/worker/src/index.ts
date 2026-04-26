import Fastify from "fastify";
import { logger } from "@repo/shared/logger";
import { healthRoutes } from "./routes/health.js";
import { startWorkers } from "./workers/index.js";

const server = Fastify({ logger: false });

await server.register(healthRoutes);

const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

await startWorkers();

await server.listen({ port, host });
logger.info({ port, host }, "Worker service started");
