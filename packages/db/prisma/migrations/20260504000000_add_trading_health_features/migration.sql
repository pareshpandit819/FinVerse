-- Add trading account subtype to financial_accounts
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "subtype" TEXT;

-- Add unrealized gain/loss and day change tracking to holdings
ALTER TABLE "holdings" ADD COLUMN IF NOT EXISTS "unrealized_gain_loss" BIGINT;
ALTER TABLE "holdings" ADD COLUMN IF NOT EXISTS "day_change" BIGINT;

-- Add structured metadata column to insights (for financial_health_report)
ALTER TABLE "insights" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
