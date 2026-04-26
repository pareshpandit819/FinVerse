import { plaidClient } from "./plaid.js";
import { createHash, createVerify, createPublicKey } from "node:crypto";
import { logger } from "@repo/shared/logger";

interface VerificationKeyCache {
  key: string;
  expiresAt: number;
}

// Cache Plaid's webhook verification key (rotates rarely; 1 hour TTL is safe)
const keyCache = new Map<string, VerificationKeyCache>();

async function getVerificationKey(keyId: string): Promise<string> {
  const cached = keyCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  const response = await plaidClient.webhookVerificationKeyGet({ key_id: keyId });
  const { key } = response.data;

  // The key is returned as a JWK — we need the PEM for Node's crypto module
  // Plaid returns the key in a format we can use directly
  const pem = jwkToPem(key);
  keyCache.set(keyId, { key: pem, expiresAt: Date.now() + 60 * 60 * 1000 });
  return pem;
}

/**
 * Verifies a Plaid webhook JWT signature.
 * Returns true if valid, false (with log warning) if invalid.
 *
 * Plaid webhooks are signed JWTs; the signature uses ES256 (ECDSA P-256).
 * Docs: https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export async function verifyPlaidWebhook(
  rawBody: string,
  plaidVerificationHeader: string | null
): Promise<boolean> {
  if (!plaidVerificationHeader) {
    logger.warn("Missing Plaid-Verification header");
    return false;
  }

  try {
    const parts = plaidVerificationHeader.split(".");
    if (parts.length !== 3) {
      logger.warn("Malformed Plaid-Verification JWT");
      return false;
    }

    const [headerB64, claimsB64, signatureB64] = parts as [string, string, string];
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString()) as {
      kid?: string;
      alg?: string;
    };

    if (!header.kid) {
      logger.warn("Missing kid in Plaid webhook JWT header");
      return false;
    }

    if (header.alg !== "ES256") {
      logger.warn({ alg: header.alg }, "Unexpected algorithm in Plaid webhook JWT");
      return false;
    }

    const pem = await getVerificationKey(header.kid);

    // Verify signature over "headerB64.claimsB64"
    const signingInput = `${headerB64}.${claimsB64}`;
    const signature = Buffer.from(signatureB64, "base64url");

    const verify = createVerify("sha256");
    verify.update(signingInput);
    const signatureValid = verify.verify(pem, signature);

    if (!signatureValid) {
      logger.warn("Plaid webhook signature verification failed");
      return false;
    }

    // Verify the body hash claim
    const claims = JSON.parse(Buffer.from(claimsB64, "base64url").toString()) as {
      iat?: number;
      request_body_sha256?: string;
    };

    // Replay protection: reject JWTs older than 5 minutes
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
    if (!claims.iat || claims.iat < fiveMinutesAgo) {
      logger.warn({ iat: claims.iat }, "Plaid webhook JWT is expired (replay attack protection)");
      return false;
    }

    // Verify body hash
    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    if (claims.request_body_sha256 !== bodyHash) {
      logger.warn("Plaid webhook body hash mismatch");
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err }, "Error verifying Plaid webhook signature");
    return false;
  }
}

/**
 * Minimal JWK → PEM conversion for EC P-256 keys (Plaid's format).
 * The Plaid SDK returns the key as an object with a `pem` field in v14+.
 */
function jwkToPem(jwk: Record<string, unknown>): string {
  // Plaid SDK v14+: key object contains a `pem` field
  if (typeof jwk["pem"] === "string") return jwk["pem"] as string;

  // Older SDK versions may return the full key blob as a string
  if (typeof jwk["key"] === "string" && (jwk["key"] as string).startsWith("-----BEGIN")) {
    return jwk["key"] as string;
  }

  // Last resort: use Node.js KeyObject API (Node 18+)
  const keyObj = createPublicKey({ key: jwk as Parameters<typeof createPublicKey>[0], format: "jwk" });
  return keyObj.export({ type: "spki", format: "pem" }) as string;
}
