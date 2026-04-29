-- CreateTable credit_scores
CREATE TABLE "credit_scores" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "score_date" DATE NOT NULL,
    "payment_history" INTEGER NOT NULL DEFAULT 0,
    "credit_utilization" INTEGER NOT NULL DEFAULT 0,
    "credit_age" INTEGER NOT NULL DEFAULT 0,
    "derogatory_marks" INTEGER NOT NULL DEFAULT 0,
    "hard_inquiries" INTEGER NOT NULL DEFAULT 0,
    "total_accounts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable credit_accounts
CREATE TABLE "credit_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "credit_limit" BIGINT,
    "account_status" TEXT NOT NULL DEFAULT 'open',
    "payment_status" TEXT NOT NULL DEFAULT 'current',
    "monthly_payment" BIGINT,
    "open_date" DATE NOT NULL,
    "last_payment_date" DATE,
    "next_payment_due" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable credit_history
CREATE TABLE "credit_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "event_description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_scores_organization_id_user_id_idx" ON "credit_scores"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "credit_scores_score_date_idx" ON "credit_scores"("score_date");

-- CreateIndex
CREATE INDEX "credit_accounts_organization_id_user_id_idx" ON "credit_accounts"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "credit_accounts_account_type_idx" ON "credit_accounts"("account_type");

-- CreateIndex
CREATE INDEX "credit_history_organization_id_user_id_idx" ON "credit_history"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "credit_history_credit_account_id_idx" ON "credit_history"("credit_account_id");

-- CreateIndex
CREATE INDEX "credit_history_event_date_idx" ON "credit_history"("event_date");

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_history" ADD CONSTRAINT "credit_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_history" ADD CONSTRAINT "credit_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
