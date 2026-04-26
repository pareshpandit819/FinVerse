import type { Job } from "bullmq";
import { logger } from "@repo/shared/logger";
import { createSyncWorker } from "./sync-worker.js";
import { createInvestmentsWorker } from "./investments-worker.js";
import { createLiabilitiesWorker } from "./liabilities-worker.js";
import { createNetWorthWorker } from "./net-worth-worker.js";
import { createBudgetWorker } from "./budget-worker.js";
import { createInsightWorker } from "./insight-worker.js";
import {
  scheduleDailySnapshots,
  scheduleMonthlyBudgetAggregation,
  scheduleWeeklyInsights,
} from "../queues/cron.js";

export async function startWorkers(): Promise<void> {
  const workers = [
    createSyncWorker(),
    createInvestmentsWorker(),
    createLiabilitiesWorker(),
    createNetWorthWorker(),
    createBudgetWorker(),
    createInsightWorker(),
  ];

  for (const worker of workers) {
    worker.on("failed", (job: Job | undefined, err: Error) => {
      logger.error(
        { jobId: job?.id, jobName: job?.name, queue: worker.name, err },
        "Worker job failed"
      );
    });
    worker.on("error", (err: Error) => {
      logger.error({ queue: worker.name, err }, "Worker error");
    });
  }

  logger.info(
    {
      queues: [
        "plaid.sync",
        "plaid.investments",
        "plaid.liabilities",
        "net-worth.snapshot",
        "budget.aggregate",
        "insights.generate",
      ],
    },
    "Workers started"
  );

  // Schedule recurring jobs — safe to call on every startup (BullMQ deduplicates by jobId)
  await Promise.all([
    scheduleDailySnapshots(),
    scheduleMonthlyBudgetAggregation(),
    scheduleWeeklyInsights(),
  ]);
}
