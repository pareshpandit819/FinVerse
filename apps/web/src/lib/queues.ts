import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env["REDIS_URL"];
if (!redisUrl) throw new Error("REDIS_URL environment variable is required");

// Singleton Redis connection for BullMQ producers in the web app
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const syncQueue = new Queue("plaid.sync", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const insightsQueue = new Queue("insights.generate", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});
