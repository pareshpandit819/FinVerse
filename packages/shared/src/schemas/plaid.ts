import { z } from "zod";

export const PlaidPublicTokenExchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().min(1),
  institutionName: z.string().min(1),
});

export const PlaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  error: z
    .object({
      error_type: z.string(),
      error_code: z.string(),
      error_message: z.string(),
    })
    .nullable()
    .optional(),
});

export const SyncJobPayloadSchema = z.object({
  plaidItemId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  isInitial: z.boolean().default(false),
});

export type PlaidPublicTokenExchange = z.infer<typeof PlaidPublicTokenExchangeSchema>;
export type PlaidWebhook = z.infer<typeof PlaidWebhookSchema>;
export type SyncJobPayload = z.infer<typeof SyncJobPayloadSchema>;
