import { http, HttpResponse } from "msw";
import {
  accountsGetResponse,
  transactionsSyncFirstPage,
  holdingsGetResponse,
  liabilitiesGetResponse,
  webhookVerificationKeyResponse,
} from "../fixtures/plaid-responses.js";

const PLAID_SANDBOX_BASE = "https://sandbox.plaid.com";

export const plaidHandlers = [
  http.post(`${PLAID_SANDBOX_BASE}/accounts/get`, () =>
    HttpResponse.json(accountsGetResponse)
  ),

  http.post(`${PLAID_SANDBOX_BASE}/transactions/sync`, () =>
    HttpResponse.json(transactionsSyncFirstPage)
  ),

  http.post(`${PLAID_SANDBOX_BASE}/investments/holdings/get`, () =>
    HttpResponse.json(holdingsGetResponse)
  ),

  http.post(`${PLAID_SANDBOX_BASE}/liabilities/get`, () =>
    HttpResponse.json(liabilitiesGetResponse)
  ),

  http.post(`${PLAID_SANDBOX_BASE}/webhook_verification_key/get`, () =>
    HttpResponse.json(webhookVerificationKeyResponse)
  ),
];

/** Handler that simulates a Plaid API error (e.g. ITEM_LOGIN_REQUIRED) */
export const plaidLoginRequiredHandler = http.post(
  `${PLAID_SANDBOX_BASE}/transactions/sync`,
  () =>
    HttpResponse.json(
      {
        error_type: "ITEM_ERROR",
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "the login details of this item have changed",
        display_message: null,
        request_id: "req-error-001",
      },
      { status: 400 }
    )
);

/** Handler simulating a Plaid rate-limit error */
export const plaidRateLimitHandler = http.post(
  `${PLAID_SANDBOX_BASE}/transactions/sync`,
  () =>
    HttpResponse.json(
      {
        error_type: "RATE_LIMIT_EXCEEDED",
        error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
        error_message: "rate limit exceeded",
        request_id: "req-rate-001",
      },
      { status: 429 }
    )
);
