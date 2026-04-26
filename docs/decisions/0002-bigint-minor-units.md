# ADR-0002: Use BigInt minor units for all monetary values

## Status
Accepted

## Context
Financial applications require exact arithmetic. IEEE 754 floating-point (JavaScript `number`) cannot represent many decimal values exactly — `0.1 + 0.2 !== 0.3`. Using floats for money leads to rounding errors that compound over thousands of transactions and produce incorrect net worth calculations.

## Decision
Store all monetary values as **BigInt minor units** (e.g., cents for USD, pence for GBP). Never use `number` or `Decimal` for money at storage or calculation boundaries.

- `$12.34` is stored as `1234n` (BigInt cents).
- Display formatting converts to the human-readable form at the UI boundary only.
- Plaid amounts (returned as floats) are converted immediately on ingestion: `Math.round(plaidAmount * 100)` → BigInt.

## Rationale
- Eliminates floating-point rounding errors entirely.
- Postgres `BIGINT` is the correct column type — no precision loss, efficient indexing.
- BigInt arithmetic in JavaScript is exact for integers of any size.
- The pattern is idiomatic for financial systems (Stripe, etc. all use minor units).

## Alternatives Considered
- **`Decimal.js` / `big.js`**: Arbitrary-precision decimals. Correct, but adds a dependency and requires serialization care (JSON doesn't support `Decimal` natively). BigInt is a language primitive.
- **Postgres `NUMERIC`**: Exact, but Prisma maps `NUMERIC` to `Decimal` (from `decimal.js`), requiring extra conversion at every boundary. BigInt → `BIGINT` is a cleaner mapping.
- **Floats**: Rejected. Correctness is non-negotiable for financial data.

## Consequences
- All money-handling code must use BigInt literals and BigInt arithmetic operators.
- Division (e.g., percentage calculations) must be handled carefully — BigInt division truncates. Intermediate results should be scaled up before dividing.
- JSON serialization: BigInt is not JSON-serializable by default. A custom replacer/reviver is required in API responses; the shared `serialize` utility handles this.
- Prisma `BigInt` fields are returned as `bigint` in TypeScript, which is correct.
