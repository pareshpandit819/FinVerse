import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env["REDIS_URL"];
if (!redisUrl) throw new Error("REDIS_URL environment variable is required");

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const netWorthQueue = new Queue("net-worth.snapshot", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

export const budgetQueue = new Queue("budget.aggregate", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
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
