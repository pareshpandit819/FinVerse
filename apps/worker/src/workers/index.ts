import type { Job } from "bullmq";
import { logger } from "@repo/shared/logger";
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
    { queues: ["net-worth.snapshot", "budget.aggregate", "insights.generate"] },
    "Workers started"
  );

  await Promise.all([
    scheduleDailySnapshots(),
    scheduleMonthlyBudgetAggregation(),
    scheduleWeeklyInsights(),
  ]);
}
