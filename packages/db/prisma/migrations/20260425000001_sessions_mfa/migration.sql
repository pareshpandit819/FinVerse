-- Add mfa_verified_at to sessions table for per-session MFA state
ALTER TABLE "sessions" ADD COLUMN "mfa_verified_at" TIMESTAMPTZ;
