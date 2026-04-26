/**
 * Static Plaid API response fixtures used by MSW handlers.
 * All amounts are in Plaid's float format (dollars); the sync worker converts
 * them to BigInt cents on ingestion.
 */

export const FIXTURE_ITEM_ID = "item-sandbox-test-001";
export const FIXTURE_ACCESS_TOKEN = "access-sandbox-test-token";
export const FIXTURE_ACCOUNT_ID = "acct-test-checking-001";
export const FIXTURE_ACCOUNT_ID_2 = "acct-test-savings-001";
export const FIXTURE_SECURITY_ID = "sec-test-vanguard-001";

export const accountsGetResponse = {
  accounts: [
    {
      account_id: FIXTURE_ACCOUNT_ID,
      name: "Plaid Checking",
      official_name: "Plaid Gold Checking",
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balances: {
        available: 100.00,
        current: 110.00,
        iso_currency_code: "USD",
        limit: null,
      },
    },
    {
      account_id: FIXTURE_ACCOUNT_ID_2,
      name: "Plaid Saving",
      official_name: null,
      type: "depository",
      subtype: "savings",
      mask: "1111",
      balances: {
        available: 200.00,
        current: 200.00,
        iso_currency_code: "USD",
        limit: null,
      },
    },
  ],
  item: { item_id: FIXTURE_ITEM_ID },
  request_id: "req-accounts-001",
};

export const transactionsSyncFirstPage = {
  added: [
    {
      transaction_id: "txn-test-001",
      account_id: FIXTURE_ACCOUNT_ID,
      amount: 12.34,
      iso_currency_code: "USD",
      date: "2026-04-20",
      name: "Whole Foods",
      merchant_name: "Whole Foods Market",
      payment_channel: "in store",
      category: ["Shops", "Grocery Stores"],
      pending: false,
    },
    {
      transaction_id: "txn-test-002",
      account_id: FIXTURE_ACCOUNT_ID,
      amount: 9.99,
      iso_currency_code: "USD",
      date: "2026-04-21",
      name: "Netflix",
      merchant_name: "Netflix",
      payment_channel: "online",
      category: ["Service", "Subscription"],
      pending: false,
    },
  ],
  modified: [],
  removed: [],
  next_cursor: "cursor-page-2",
  has_more: false,
  request_id: "req-sync-001",
};

export const transactionsSyncWithModifiedAndRemoved = {
  added: [],
  modified: [
    {
      transaction_id: "txn-test-001",
      account_id: FIXTURE_ACCOUNT_ID,
      amount: 15.00,
      iso_currency_code: "USD",
      date: "2026-04-20",
      name: "Whole Foods Market",
      merchant_name: "Whole Foods Market",
      payment_channel: "in store",
      category: ["Shops", "Grocery Stores"],
      pending: false,
    },
  ],
  removed: [{ transaction_id: "txn-test-002" }],
  next_cursor: "cursor-page-3",
  has_more: false,
  request_id: "req-sync-002",
};

export const holdingsGetResponse = {
  accounts: [
    {
      account_id: "acct-test-brokerage-001",
      name: "Plaid IRA",
      type: "investment",
      subtype: "ira",
      mask: "6666",
      balances: { current: 3250.00, iso_currency_code: "USD" },
    },
  ],
  holdings: [
    {
      account_id: "acct-test-brokerage-001",
      security_id: FIXTURE_SECURITY_ID,
      quantity: 10.5,
      institution_value: 3150.00,
      cost_basis: 2800.00,
      iso_currency_code: "USD",
    },
  ],
  securities: [
    {
      security_id: FIXTURE_SECURITY_ID,
      name: "Vanguard Total Stock Market ETF",
      ticker_symbol: "VTI",
      type: "etf",
      iso_currency_code: "USD",
      close_price: 300.00,
      close_price_as_of: "2026-04-24",
    },
  ],
  request_id: "req-holdings-001",
};

export const liabilitiesGetResponse = {
  liabilities: {
    credit: [
      {
        account_id: "acct-test-credit-001",
        last_payment_amount: 150.00,
        last_payment_date: "2026-04-01",
        minimum_payment_amount: 25.00,
        next_payment_due_date: "2026-05-01",
      },
    ],
    student: [],
    mortgage: [],
  },
  accounts: [],
  request_id: "req-liabilities-001",
};

export const webhookVerificationKeyResponse = {
  key: {
    alg: "ES256",
    crv: "P-256",
    kid: "test-key-id-001",
    kty: "EC",
    use: "sig",
    x: "test-x-value",
    y: "test-y-value",
    // In tests we provide the pem directly to bypass JWK parsing
    pem: "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----",
  },
  request_id: "req-key-001",
};
