# ADR-0003: AES-256-GCM for Plaid token encryption (KMS envelope in production)

## Status
Accepted

## Context
Plaid access tokens grant direct read access to a user's linked bank accounts. They must be stored encrypted at rest such that a database breach alone does not expose live financial access. The encryption design must work locally (without AWS) and scale to production (with AWS KMS).

## Decision
Use **AES-256-GCM** (authenticated encryption) for Plaid access tokens, with an envelope encryption pattern in production.

### Local / development
```
key   = Buffer.from(PLAID_TOKEN_ENCRYPTION_KEY, 'hex')  // 32 bytes, from env
iv    = crypto.randomBytes(12)                            // unique per token
{ ciphertext, authTag } = crypto.createCipheriv('aes-256-gcm', key, iv)
stored = base64(iv + authTag + ciphertext)
```

### Production (AWS KMS envelope)
1. `kms.generateDataKey({ KeyId, KeySpec: 'AES_256' })` → `{ Plaintext, CiphertextBlob }`
2. Encrypt access token with `Plaintext` data key (AES-256-GCM as above).
3. Store: `base64(CiphertextBlob) + "|" + base64(iv + authTag + ciphertext)`.
4. Decrypt: `kms.decrypt(CiphertextBlob)` → plaintext key → AES-GCM decrypt.
5. KMS key policy: only the ECS task role for `apps/web` and `apps/worker` can `kms:Decrypt`.

## Rationale
- GCM provides both confidentiality (AES) and integrity (GHASH auth tag) — protects against bit-flipping attacks.
- Random IV per encryption prevents ciphertext patterns across tokens.
- Envelope encryption separates key material from ciphertext; rotating the KMS key doesn't require re-encrypting all tokens (re-wrap instead).
- The local pattern (env key) allows development without AWS dependencies.

## Alternatives Considered
- **bcrypt / argon2**: Hash functions, not ciphers — cannot decrypt. Not applicable here.
- **RSA encryption**: Asymmetric; slower; key size limits plaintext; not idiomatic for bulk data encryption.
- **Vault (HashiCorp)**: Excellent, but adds operational complexity for v0.1. KMS is sufficient; Vault can be adopted later.
- **Store tokens in AWS Secrets Manager directly**: Each Plaid item would be a separate secret — costs $0.40/secret/month. At 10k users × avg 3 items = $12k/month just for secret storage. Not viable.

## Consequences
- `packages/shared/src/crypto.ts` exports `encryptToken` and `decryptToken` with clear environment-switching logic.
- The `PLAID_TOKEN_ENCRYPTION_KEY` env var must be a 64-character hex string (32 bytes).
- Key rotation procedure documented in `docs/RUNBOOK.md`: generate new key, re-encrypt all tokens in a migration script, update env.
