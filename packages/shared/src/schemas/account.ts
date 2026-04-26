import { z } from "zod";

export const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "investment", "loan", "other"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

export const TRANSACTION_CATEGORIES = [
  "Food & Dining",
  "Travel & Transport",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Health & Wellness",
  "Education",
  "Subscriptions",
  "Transfers",
  "Income",
  "Other",
] as const;

export const CreateAccountSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  balanceCurrent: z.number(),
  isoCurrencyCode: z.string().length(3).default("USD"),
});

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balanceCurrent: z.number().optional(),
});

export const CreateTransactionSchema = z.object({
  financialAccountId: z.string().min(1),
  organizationId: z.string().min(1),
  amount: z.number(),
  name: z.string().min(1).max(200),
  date: z.string().min(1),
  customCategory: z.string().optional(),
  merchantName: z.string().max(100).optional(),
  pending: z.boolean().default(false),
  isoCurrencyCode: z.string().length(3).default("USD"),
});

export type CreateAccount = z.infer<typeof CreateAccountSchema>;
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
