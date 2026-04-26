import { z } from "zod";

export const GoalCreateSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.bigint().positive(),
  targetDate: z.coerce.date().refine((d) => d > new Date(), {
    message: "Target date must be in the future",
  }),
  linkedAccountIds: z.array(z.string().uuid()).max(10).default([]),
});

export const GoalUpdateSchema = GoalCreateSchema.partial().omit({ linkedAccountIds: true }).extend({
  linkedAccountIds: z.array(z.string().uuid()).max(10).optional(),
});

export type GoalCreate = z.infer<typeof GoalCreateSchema>;
export type GoalUpdate = z.infer<typeof GoalUpdateSchema>;
