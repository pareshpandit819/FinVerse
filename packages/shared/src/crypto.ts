import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/** Encrypts a TOTP secret using MFA_SECRET_ENCRYPTION_KEY. */
export function encryptMfaSecret(plaintext: string): string {
  const keyHex = process.env["MFA_SECRET_ENCRYPTION_KEY"];
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("MFA_SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptMfaSecret(encoded: string): string {
  const keyHex = process.env["MFA_SECRET_ENCRYPTION_KEY"];
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("MFA_SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
