import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken, encryptMfaSecret, decryptMfaSecret } from "../crypto.js";

beforeAll(() => {
  // 64-char hex = 32 bytes — matches what openssl rand -hex 32 produces
  process.env["PLAID_TOKEN_ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["MFA_SECRET_ENCRYPTION_KEY"] = "b".repeat(64);
});

describe("Plaid token encryption", () => {
  it("round-trips a plaintext access token", () => {
    const plaintext = "access-sandbox-abc123xyz-token";
    const ciphertext = encryptToken(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptToken(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const plaintext = "access-sandbox-same-token";
    const c1 = encryptToken(plaintext);
    const c2 = encryptToken(plaintext);
    expect(c1).not.toBe(c2);
    // Both should decrypt to the same plaintext
    expect(decryptToken(c1)).toBe(plaintext);
    expect(decryptToken(c2)).toBe(plaintext);
  });

  it("throws on tampered ciphertext (auth tag check)", () => {
    const ciphertext = encryptToken("some-token");
    const buf = Buffer.from(ciphertext, "base64");
    // Flip a byte in the ciphertext region (after iv + authTag)
    buf[29] = (buf[29] ?? 0) ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });
});

describe("MFA secret encryption", () => {
  it("round-trips a TOTP base32 secret", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaSecret(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it("uses a different key from Plaid tokens", () => {
    const plaintext = "same-plaintext";
    const plaidCipher = encryptToken(plaintext);
    const mfaCipher = encryptMfaSecret(plaintext);
    // Different keys → different ciphertexts
    expect(plaidCipher).not.toBe(mfaCipher);
  });
});
