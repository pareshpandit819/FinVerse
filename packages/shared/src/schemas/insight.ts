import { z } from "zod";

export const InsightTypeSchema = z.enum([
  "spending_anomaly",
  "subscription_audit",
  "goal_pacing",
  "savings_opportunity",
  "budget_breach_forecast",
]);

export type InsightType = z.infer<typeof InsightTypeSchema>;

export const InsightSchema = z.object({
  type: InsightTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  actionItems: z.array(z.string().max(300)).max(5).default([]),
});

export type Insight = z.infer<typeof InsightSchema>;

export const InsightFeedbackSchema = z.object({
  helpful: z.boolean(),
});

export const InsightJobPayloadSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  insightType: InsightTypeSchema.optional(),
  requestedAt: z.string().datetime(),
});

export type InsightJobPayload = z.infer<typeof InsightJobPayloadSchema>;
