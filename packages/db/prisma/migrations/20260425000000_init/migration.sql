-- Migration: Initial schema
-- Generated for Enterprise Financial Dashboard v0.1.0

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- ---------------------------------------------------------------------------
-- Auth.js required tables
-- ---------------------------------------------------------------------------
CREATE TABLE "accounts" (
    "id"                  TEXT        NOT NULL,
    "user_id"             UUID        NOT NULL,
    "type"                TEXT        NOT NULL,
    "provider"            TEXT        NOT NULL,
    "provider_account_id" TEXT        NOT NULL,
    "refresh_token"       TEXT,
    "access_token"        TEXT,
    "expires_at"          INTEGER,
    "token_type"          TEXT,
    "scope"               TEXT,
    "id_token"            TEXT,
    "session_state"       TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_tokens" (
    "identifier" TEXT        NOT NULL,
    "token"      TEXT        NOT NULL,
    "expires"    TIMESTAMPTZ NOT NULL,
    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier", "token"),
    CONSTRAINT "verification_tokens_token_key" UNIQUE ("token")
);

-- ---------------------------------------------------------------------------
-- Core application tables
-- ---------------------------------------------------------------------------
CREATE TABLE "users" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "email"             TEXT        NOT NULL,
    "name"              TEXT,
    "avatar_url"        TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE TABLE "sessions" (
    "id"            TEXT        NOT NULL,
    "session_token" TEXT        NOT NULL,
    "user_id"       UUID        NOT NULL,
    "expires"       TIMESTAMPTZ NOT NULL,
    "ip_address"    TEXT,
    "user_agent"    TEXT,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_session_token_key" UNIQUE ("session_token")
);

CREATE TABLE "mfa_secrets" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"          UUID        NOT NULL,
    "encrypted_secret" TEXT        NOT NULL,
    "verified"         BOOLEAN     NOT NULL DEFAULT FALSE,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizations" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT        NOT NULL,
    "slug"       TEXT        NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_slug_key" UNIQUE ("slug")
);

CREATE TABLE "memberships" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID        NOT NULL,
    "user_id"         UUID        NOT NULL,
    "role"            "Role"      NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_org_user_key" UNIQUE ("organization_id", "user_id")
);

CREATE TABLE "audit_logs" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"         UUID,
    "organization_id" UUID,
    "action"          TEXT        NOT NULL,
    "entity_type"     TEXT        NOT NULL,
    "entity_id"       UUID,
    "before"          JSONB,
    "after"           JSONB,
    "ip_address"      TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Plaid tables
-- ---------------------------------------------------------------------------
CREATE TABLE "plaid_items" (
    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"       UUID        NOT NULL,
    "user_id"               UUID        NOT NULL,
    "encrypted_access_token" TEXT       NOT NULL,
    "item_id"               TEXT        NOT NULL,
    "institution_id"        TEXT        NOT NULL,
    "institution_name"      TEXT        NOT NULL,
    "status"                TEXT        NOT NULL DEFAULT 'active',
    "consent_expires_at"    TIMESTAMPTZ,
    "last_synced_at"        TIMESTAMPTZ,
    "transaction_cursor"    TEXT,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plaid_items_item_id_key" UNIQUE ("item_id")
);

CREATE TABLE "plaid_accounts" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "plaid_item_id"     UUID        NOT NULL,
    "organization_id"   UUID        NOT NULL,
    "account_id"        TEXT        NOT NULL,
    "name"              TEXT        NOT NULL,
    "official_name"     TEXT,
    "type"              TEXT        NOT NULL,
    "subtype"           TEXT,
    "mask"              TEXT,
    "balance_current"   BIGINT      NOT NULL DEFAULT 0,
    "balance_available" BIGINT,
    "balance_limit"     BIGINT,
    "iso_currency_code" TEXT        NOT NULL DEFAULT 'USD',
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "plaid_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plaid_accounts_account_id_key" UNIQUE ("account_id")
);

CREATE TABLE "transactions" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "plaid_account_id"  UUID        NOT NULL,
    "organization_id"   UUID        NOT NULL,
    "transaction_id"    TEXT        NOT NULL,
    "amount"            BIGINT      NOT NULL,
    "iso_currency_code" TEXT        NOT NULL DEFAULT 'USD',
    "date"              DATE        NOT NULL,
    "name"              TEXT        NOT NULL,
    "merchant_name"     TEXT,
    "payment_channel"   TEXT,
    "plaid_categories"  TEXT[]      NOT NULL DEFAULT '{}',
    "custom_category"   TEXT,
    "pending"           BOOLEAN     NOT NULL DEFAULT FALSE,
    "metadata"          JSONB,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transactions_transaction_id_key" UNIQUE ("transaction_id")
);

CREATE TABLE "securities" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "plaid_security_id"  TEXT        NOT NULL,
    "name"               TEXT        NOT NULL,
    "ticker_symbol"      TEXT,
    "type"               TEXT        NOT NULL,
    "iso_currency_code"  TEXT        NOT NULL DEFAULT 'USD',
    "close_price"        BIGINT,
    "close_price_as_of"  DATE,
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "securities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "securities_plaid_security_id_key" UNIQUE ("plaid_security_id")
);

CREATE TABLE "holdings" (
    "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "plaid_account_id" UUID           NOT NULL,
    "security_id"      UUID           NOT NULL,
    "organization_id"  UUID           NOT NULL,
    "quantity"         DECIMAL(20, 8) NOT NULL,
    "institution_value" BIGINT        NOT NULL,
    "cost_basis"       BIGINT,
    "iso_currency_code" TEXT          NOT NULL DEFAULT 'USD',
    "updated_at"       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "holdings_account_security_key" UNIQUE ("plaid_account_id", "security_id")
);

CREATE TABLE "liabilities" (
    "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    "plaid_account_id"       UUID        NOT NULL,
    "organization_id"        UUID        NOT NULL,
    "type"                   TEXT        NOT NULL,
    "last_payment_amount"    BIGINT,
    "last_payment_date"      DATE,
    "minimum_payment_amount" BIGINT,
    "next_payment_due_date"  DATE,
    "metadata"               JSONB,
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "liabilities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "liabilities_plaid_account_id_key" UNIQUE ("plaid_account_id")
);

-- ---------------------------------------------------------------------------
-- Financial feature tables
-- ---------------------------------------------------------------------------
CREATE TABLE "net_worth_snapshots" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"  UUID        NOT NULL,
    "user_id"          UUID        NOT NULL,
    "total_assets"     BIGINT      NOT NULL,
    "total_liabilities" BIGINT     NOT NULL,
    "net_worth"        BIGINT      NOT NULL,
    "snapshot_date"    DATE        NOT NULL,
    "breakdown"        JSONB       NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "net_worth_snapshots_org_user_date_key" UNIQUE ("organization_id", "user_id", "snapshot_date")
);

CREATE TABLE "goals" (
    "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"   UUID           NOT NULL,
    "user_id"           UUID           NOT NULL,
    "name"              TEXT           NOT NULL,
    "target_amount"     BIGINT         NOT NULL,
    "current_amount"    BIGINT         NOT NULL DEFAULT 0,
    "target_date"       DATE           NOT NULL,
    "contribution_rate" DECIMAL(20, 2) NOT NULL DEFAULT 0,
    "linked_account_ids" TEXT[]        NOT NULL DEFAULT '{}',
    "is_completed"      BOOLEAN        NOT NULL DEFAULT FALSE,
    "created_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budgets" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID        NOT NULL,
    "user_id"         UUID        NOT NULL,
    "name"            TEXT        NOT NULL,
    "month"           INTEGER     NOT NULL,
    "year"            INTEGER     NOT NULL,
    "rollover"        BOOLEAN     NOT NULL DEFAULT FALSE,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budgets_org_user_month_year_key" UNIQUE ("organization_id", "user_id", "month", "year")
);

CREATE TABLE "budget_categories" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "budget_id"    UUID        NOT NULL,
    "category"     TEXT        NOT NULL,
    "limit_amount" BIGINT      NOT NULL,
    "spent_amount" BIGINT      NOT NULL DEFAULT 0,
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budget_categories_budget_category_key" UNIQUE ("budget_id", "category")
);

CREATE TABLE "insights" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID        NOT NULL,
    "user_id"         UUID        NOT NULL,
    "type"            TEXT        NOT NULL,
    "title"           TEXT        NOT NULL,
    "body"            TEXT        NOT NULL,
    "severity"        TEXT        NOT NULL DEFAULT 'info',
    "action_items"    TEXT[]      NOT NULL DEFAULT '{}',
    "tool_call_log"   JSONB       NOT NULL,
    "model_id"        TEXT        NOT NULL,
    "prompt_hash"     TEXT        NOT NULL,
    "input_tokens"    INTEGER     NOT NULL,
    "output_tokens"   INTEGER     NOT NULL,
    "helpful"         BOOLEAN,
    "generated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expires_at"      TIMESTAMPTZ NOT NULL,
    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "mfa_secrets" ADD CONSTRAINT "mfa_secrets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;

ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_plaid_item_id_fkey"
    FOREIGN KEY ("plaid_item_id") REFERENCES "plaid_items"("id") ON DELETE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_plaid_account_id_fkey"
    FOREIGN KEY ("plaid_account_id") REFERENCES "plaid_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "holdings" ADD CONSTRAINT "holdings_plaid_account_id_fkey"
    FOREIGN KEY ("plaid_account_id") REFERENCES "plaid_accounts"("id") ON DELETE CASCADE;
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_security_id_fkey"
    FOREIGN KEY ("security_id") REFERENCES "securities"("id");

ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_plaid_account_id_fkey"
    FOREIGN KEY ("plaid_account_id") REFERENCES "plaid_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_budget_id_fkey"
    FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE;

ALTER TABLE "insights" ADD CONSTRAINT "insights_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "plaid_items_organization_id_idx" ON "plaid_items"("organization_id");
CREATE INDEX "plaid_items_user_id_idx" ON "plaid_items"("user_id");
CREATE INDEX "plaid_accounts_organization_id_idx" ON "plaid_accounts"("organization_id");
CREATE INDEX "plaid_accounts_plaid_item_id_idx" ON "plaid_accounts"("plaid_item_id");
CREATE INDEX "transactions_organization_id_idx" ON "transactions"("organization_id");
CREATE INDEX "transactions_plaid_account_id_idx" ON "transactions"("plaid_account_id");
CREATE INDEX "transactions_date_idx" ON "transactions"("date");
CREATE INDEX "holdings_organization_id_idx" ON "holdings"("organization_id");
CREATE INDEX "liabilities_organization_id_idx" ON "liabilities"("organization_id");
CREATE INDEX "net_worth_snapshots_user_id_date_idx" ON "net_worth_snapshots"("user_id", "snapshot_date");
CREATE INDEX "goals_organization_id_user_id_idx" ON "goals"("organization_id", "user_id");
CREATE INDEX "insights_user_id_generated_at_idx" ON "insights"("user_id", "generated_at");
CREATE INDEX "insights_expires_at_idx" ON "insights"("expires_at");

-- ---------------------------------------------------------------------------
-- audit_logs: prevent UPDATE and DELETE (append-only)
-- ---------------------------------------------------------------------------
CREATE RULE "audit_logs_no_update" AS ON UPDATE TO "audit_logs" DO INSTEAD NOTHING;
CREATE RULE "audit_logs_no_delete" AS ON DELETE TO "audit_logs" DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS on all org-scoped tables
ALTER TABLE "plaid_items"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plaid_accounts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holdings"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liabilities"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "net_worth_snapshots"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_categories"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insights"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (superuser bypass is fine for migrations)
ALTER TABLE "plaid_items"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "plaid_accounts"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "transactions"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "holdings"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "liabilities"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "net_worth_snapshots"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "goals"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "budgets"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "insights"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "memberships"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           FORCE ROW LEVEL SECURITY;

-- budget_categories are accessed through budgets (always joined),
-- but we add RLS via their parent budget's org
ALTER TABLE "budget_categories"    FORCE ROW LEVEL SECURITY;

-- Helper function: get current org context (returns NULL if not set)
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Policies: each table allows SELECT/INSERT/UPDATE/DELETE only within the current org context
-- The superuser/migration role bypasses RLS (FORCE RLS only affects non-superusers).

CREATE POLICY "plaid_items_org_isolation"       ON "plaid_items"         USING (organization_id = app_current_org_id());
CREATE POLICY "plaid_accounts_org_isolation"    ON "plaid_accounts"      USING (organization_id = app_current_org_id());
CREATE POLICY "transactions_org_isolation"      ON "transactions"        USING (organization_id = app_current_org_id());
CREATE POLICY "holdings_org_isolation"          ON "holdings"            USING (organization_id = app_current_org_id());
CREATE POLICY "liabilities_org_isolation"       ON "liabilities"         USING (organization_id = app_current_org_id());
CREATE POLICY "net_worth_snapshots_org_isolation" ON "net_worth_snapshots" USING (organization_id = app_current_org_id());
CREATE POLICY "goals_org_isolation"             ON "goals"               USING (organization_id = app_current_org_id());
CREATE POLICY "budgets_org_isolation"           ON "budgets"             USING (organization_id = app_current_org_id());
CREATE POLICY "insights_org_isolation"          ON "insights"            USING (organization_id = app_current_org_id());
CREATE POLICY "memberships_org_isolation"       ON "memberships"         USING (organization_id = app_current_org_id());
CREATE POLICY "audit_logs_org_isolation"        ON "audit_logs"          USING (organization_id = app_current_org_id());

-- budget_categories: isolated via their parent budget
CREATE POLICY "budget_categories_org_isolation" ON "budget_categories"
    USING (budget_id IN (SELECT id FROM "budgets" WHERE organization_id = app_current_org_id()));

-- ---------------------------------------------------------------------------
-- App DB role (least privilege — used by the application at runtime)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'efd_app') THEN
    CREATE ROLE efd_app LOGIN PASSWORD 'change_in_production';
  END IF;
END
$$;

DO $$ BEGIN EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO efd_app'; END $$;
GRANT USAGE ON SCHEMA public TO efd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO efd_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO efd_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO efd_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO efd_app;

-- audit_logs: app role can INSERT only (no UPDATE/DELETE — enforced by the rules above too)
REVOKE UPDATE, DELETE ON "audit_logs" FROM efd_app;
