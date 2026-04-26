import { z } from "zod";

export const BudgetCategorySchema = z.object({
  category: z.string().min(1).max(100),
  limitAmount: z.bigint().nonnegative(),
});

export const BudgetCreateSchema = z.object({
  name: z.string().min(1).max(100),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  rollover: z.boolean().default(false),
  categories: z.array(BudgetCategorySchema).min(1).max(50),
});

export const BudgetUpdateSchema = BudgetCreateSchema.partial();

export type BudgetCreate = z.infer<typeof BudgetCreateSchema>;
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>;
