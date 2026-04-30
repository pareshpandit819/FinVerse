-- CreateTable "debt_accounts"
CREATE TABLE "debt_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "current_balance" BIGINT NOT NULL,
    "minimum_payment" BIGINT NOT NULL,
    "interest_rate" NUMERIC(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable "payoff_strategies"
CREATE TABLE "payoff_strategies" (
    "id" UUID NOT NULL,
    "debt_account_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "strategy_type" TEXT NOT NULL,
    "monthly_payment_amount" BIGINT NOT NULL,
    "projected_payoff_months" INTEGER NOT NULL,
    "total_interest_paid" BIGINT NOT NULL,
    "payoff_date" DATE NOT NULL,
    "schedule" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payoff_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable "payoff_plans"
CREATE TABLE "payoff_plans" (
    "id" UUID NOT NULL,
    "debt_account_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "strategy_type" TEXT NOT NULL,
    "monthly_payment_amount" BIGINT NOT NULL,
    "start_date" DATE NOT NULL,
    "projected_payoff_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_interest_saved" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payoff_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable "alert_rules"
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "condition_type" TEXT NOT NULL,
    "threshold" BIGINT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notification_method" TEXT NOT NULL DEFAULT 'email',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable "alert_history"
CREATE TABLE "alert_history" (
    "id" UUID NOT NULL,
    "alert_rule_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trigger_value" BIGINT,
    "message" TEXT NOT NULL,
    "was_viewed" BOOLEAN NOT NULL DEFAULT false,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable "spending_forecasts"
CREATE TABLE "spending_forecasts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "forecast_type" TEXT NOT NULL,
    "category" TEXT,
    "forecast_start_date" DATE NOT NULL,
    "forecast_end_date" DATE NOT NULL,
    "predicted_amount" BIGINT NOT NULL,
    "confidence_score" NUMERIC(3,2) NOT NULL,
    "data_points" INTEGER NOT NULL DEFAULT 0,
    "forecast" JSONB NOT NULL,
    "methodology" TEXT NOT NULL DEFAULT 'linear_regression',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spending_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_accounts_organization_id_user_id_idx" ON "debt_accounts"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "debt_accounts_account_type_idx" ON "debt_accounts"("account_type");

-- CreateIndex
CREATE INDEX "payoff_strategies_debt_account_id_idx" ON "payoff_strategies"("debt_account_id");

-- CreateIndex
CREATE INDEX "payoff_strategies_organization_id_user_id_idx" ON "payoff_strategies"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "payoff_plans_organization_id_user_id_idx" ON "payoff_plans"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "payoff_plans_is_active_idx" ON "payoff_plans"("is_active");

-- CreateIndex
CREATE INDEX "alert_rules_organization_id_user_id_idx" ON "alert_rules"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "alert_rules_rule_type_idx" ON "alert_rules"("rule_type");

-- CreateIndex
CREATE INDEX "alert_rules_is_enabled_idx" ON "alert_rules"("is_enabled");

-- CreateIndex
CREATE INDEX "alert_history_alert_rule_id_idx" ON "alert_history"("alert_rule_id");

-- CreateIndex
CREATE INDEX "alert_history_organization_id_user_id_idx" ON "alert_history"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "alert_history_triggered_at_idx" ON "alert_history"("triggered_at");

-- CreateIndex
CREATE INDEX "alert_history_was_viewed_idx" ON "alert_history"("was_viewed");

-- CreateIndex
CREATE INDEX "spending_forecasts_organization_id_user_id_idx" ON "spending_forecasts"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "spending_forecasts_forecast_type_idx" ON "spending_forecasts"("forecast_type");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "spending_forecasts_organization_id_user_id_forecast_type_categ_key" ON "spending_forecasts"("organization_id", "user_id", "forecast_type", "category", "forecast_start_date");

-- AddForeignKey
ALTER TABLE "debt_accounts" ADD CONSTRAINT "debt_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_accounts" ADD CONSTRAINT "debt_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_strategies" ADD CONSTRAINT "payoff_strategies_debt_account_id_fkey" FOREIGN KEY ("debt_account_id") REFERENCES "debt_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_strategies" ADD CONSTRAINT "payoff_strategies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_strategies" ADD CONSTRAINT "payoff_strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_plans" ADD CONSTRAINT "payoff_plans_debt_account_id_fkey" FOREIGN KEY ("debt_account_id") REFERENCES "debt_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_plans" ADD CONSTRAINT "payoff_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payoff_plans" ADD CONSTRAINT "payoff_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_forecasts" ADD CONSTRAINT "spending_forecasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_forecasts" ADD CONSTRAINT "spending_forecasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
