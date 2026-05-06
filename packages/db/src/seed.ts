// @ts-nocheck — seed runs via tsx which skips type checking; Prisma types resolve correctly at runtime
/**
 * FinVerse comprehensive demo seed
 *
 * CREDENTIALS
 * ──────────────────────────────────────────────
 *   Email   : demo@finverse.app
 *   Password: Demo@2024
 * ──────────────────────────────────────────────
 *
 * Run on a fresh DB:
 *   pnpm db:reset && pnpm db:seed
 */

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ log: ["warn", "error"] });

// ─── date helpers ─────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function futureDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}
function dateFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Simple amortization for payoff schedules
function buildSchedule(
  principalCents: number,
  annualRatePct: number,
  monthlyPaymentCents: number,
  maxMonths = 60
): { month: number; balance: number; interest: number; principal: number; payment: number }[] {
  const schedule = [];
  let balance = principalCents;
  const monthlyRate = annualRatePct / 100 / 12;
  for (let m = 1; m <= maxMonths && balance > 0; m++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPaid = Math.min(monthlyPaymentCents - interest, balance);
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month: m, balance, interest, principal: principalPaid, payment: monthlyPaymentCents });
  }
  return schedule;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("\n🌱  Seeding FinVerse demo database…\n");

  // ── 1. Organisation ──────────────────────────────────────────────────────────
  const org = await db.organization.upsert({
    where: { slug: "johnson-household" },
    update: {},
    create: { name: "Johnson Household", slug: "johnson-household" },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // ── 2. Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Demo@2024", 12);

  const demo = await db.user.upsert({
    where: { email: "demo@finverse.app" },
    update: { password: passwordHash, name: "Alex Johnson" },
    create: {
      email: "demo@finverse.app",
      name: "Alex Johnson",
      password: passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const viewer = await db.user.upsert({
    where: { email: "viewer@finverse.app" },
    update: { password: passwordHash },
    create: {
      email: "viewer@finverse.app",
      name: "Sam Viewer",
      password: passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("  ✓ Users: demo@finverse.app / Demo@2024");

  // ── 3. Memberships ───────────────────────────────────────────────────────────
  await db.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demo.id } },
    update: {},
    create: { organizationId: org.id, userId: demo.id, role: "OWNER" },
  });
  await db.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: viewer.id } },
    update: {},
    create: { organizationId: org.id, userId: viewer.id, role: "VIEWER" },
  });
  console.log("  ✓ Memberships");

  // ── 4. Financial accounts (7) ────────────────────────────────────────────────
  async function upsertAccount(
    name: string,
    type: string,
    subtype: string | null,
    balanceCents: bigint
  ) {
    const existing = await db.financialAccount.findFirst({
      where: { organizationId: org.id, name },
    });
    if (existing) {
      return db.financialAccount.update({
        where: { id: existing.id },
        data: { ...(subtype !== null && { subtype }), balanceCurrent: balanceCents },
      });
    }
    return db.financialAccount.create({
      data: {
        organizationId: org.id,
        userId: demo.id,
        name,
        type,
        subtype,
        balanceCurrent: balanceCents,
        isoCurrencyCode: "USD",
      },
    });
  }

  const checking  = await upsertAccount("Chase Checking",           "depository", "checking",   624_750n);
  const savings   = await upsertAccount("Marcus Savings",           "depository", "savings",  1_843_000n);
  const amex      = await upsertAccount("Amex Gold Card",           "credit",     null,          124_836n);
  const chase     = await upsertAccount("Chase Sapphire Preferred", "credit",     null,                0n);
  const ira       = await upsertAccount("Fidelity Roth IRA",        "investment", "roth_ira",  4_285_000n);
  const brokerage = await upsertAccount("Schwab Brokerage",         "investment", "brokerage", 1_245_595n);
  const carLoan   = await upsertAccount("Toyota Auto Loan",         "loan",       null,        1_420_000n);

  console.log("  ✓ Financial accounts (checking, savings, 2 credit cards, IRA, brokerage, auto loan)");

  // ── 6. Securities + Holdings ─────────────────────────────────────────────────
  const holdingCount = await db.holding.count({ where: { organizationId: org.id } });
  if (holdingCount === 0) {
    const securities = [
      // IRA holdings
      { id: "sec-vti",   name: "Vanguard Total Stock Market ETF", ticker: "VTI",   type: "etf",   price: 44_230n },
      { id: "sec-aapl",  name: "Apple Inc.",                      ticker: "AAPL",  type: "equity", price: 21_138n },
      { id: "sec-msft",  name: "Microsoft Corporation",           ticker: "MSFT",  type: "equity", price: 42_856n },
      { id: "sec-vxus",  name: "Vanguard Total Intl Stock ETF",   ticker: "VXUS",  type: "etf",   price:  6_120n },
      { id: "sec-bnd",   name: "Vanguard Total Bond Market ETF",  ticker: "BND",   type: "etf",   price:  7_680n },
      { id: "sec-nvda",  name: "NVIDIA Corporation",              ticker: "NVDA",  type: "equity", price: 122_390n },
      { id: "sec-googl", name: "Alphabet Inc. Class A",           ticker: "GOOGL", type: "equity", price: 181_670n },
      // Brokerage holdings
      { id: "sec-tsla",  name: "Tesla Inc.",                      ticker: "TSLA",  type: "equity", price: 24_567n },
      { id: "sec-spy",   name: "SPDR S&P 500 ETF Trust",         ticker: "SPY",   type: "etf",   price: 55_205n },
      { id: "sec-amzn",  name: "Amazon.com Inc.",                 ticker: "AMZN",  type: "equity", price: 20_365n },
      { id: "sec-meta",  name: "Meta Platforms Inc.",             ticker: "META",  type: "equity", price: 59_410n },
    ];

    for (const s of securities) {
      await db.security.upsert({
        where: { securityId: s.id },
        create: {
          securityId: s.id,
          name: s.name,
          tickerSymbol: s.ticker,
          type: s.type,
          isoCurrencyCode: "USD",
          closePrice: s.price,
        },
        update: { closePrice: s.price },
      });
    }

    // IRA holdings
    const iraHoldings = [
      { secId: "sec-vti",   qty: "45.000",  value: 1_990_350n, cost: 1_620_000n },
      { secId: "sec-aapl",  qty: "18.500",  value:   834_405n, cost:   694_500n },
      { secId: "sec-msft",  qty: "7.000",   value:   673_420n, cost:   532_000n },
      { secId: "sec-vxus",  qty: "60.000",  value:   367_200n, cost:   390_000n },
      { secId: "sec-bnd",   qty: "48.000",  value:   368_640n, cost:   360_000n },
      { secId: "sec-nvda",  qty: "2.500",   value:   305_975n, cost:   125_000n },
      { secId: "sec-googl", qty: "3.000",   value:   545_010n, cost:   399_000n },
    ];

    for (const h of iraHoldings) {
      const sec = await db.security.findUnique({ where: { securityId: h.secId } });
      if (!sec) continue;
      const gain = h.value - h.cost;
      await db.holding.create({
        data: {
          financialAccountId: ira.id,
          securityId: sec.id,
          organizationId: org.id,
          quantity: h.qty,
          institutionValue: h.value,
          costBasis: h.cost,
          unrealizedGainLoss: gain,
          isoCurrencyCode: "USD",
        },
      });
    }

    // Brokerage holdings — taxable account, bigger gains for tax demo
    const brokerageHoldings = [
      { secId: "sec-tsla", qty: "10.000",  value:   245_670n, cost:   150_000n },
      { secId: "sec-spy",  qty: "8.000",   value:   441_640n, cost:   320_000n },
      { secId: "sec-amzn", qty: "5.000",   value:   101_825n, cost:    75_000n },
      { secId: "sec-meta", qty: "6.000",   value:   356_460n, cost:   240_000n },
    ];

    for (const h of brokerageHoldings) {
      const sec = await db.security.findUnique({ where: { securityId: h.secId } });
      if (!sec) continue;
      const gain = h.value - h.cost;
      await db.holding.create({
        data: {
          financialAccountId: brokerage.id,
          securityId: sec.id,
          organizationId: org.id,
          quantity: h.qty,
          institutionValue: h.value,
          costBasis: h.cost,
          unrealizedGainLoss: gain,
          isoCurrencyCode: "USD",
        },
      });
    }

    // Update account balances to match holdings
    const iraTotal = iraHoldings.reduce((s, h) => s + h.value, 0n);
    const brokTotal = brokerageHoldings.reduce((s, h) => s + h.value, 0n);
    await db.financialAccount.update({ where: { id: ira.id }, data: { balanceCurrent: iraTotal } });
    await db.financialAccount.update({ where: { id: brokerage.id }, data: { balanceCurrent: brokTotal } });

    console.log("  ✓ Securities + Holdings (7 IRA + 4 brokerage positions)");
  }

  // ── 7. Liability (auto loan) ─────────────────────────────────────────────────
  const hasLiability = await db.liability.findFirst({ where: { financialAccountId: carLoan.id } });
  if (!hasLiability) {
    await db.liability.create({
      data: {
        financialAccountId: carLoan.id,
        organizationId: org.id,
        type: "auto_loan",
        metadata: {
          interestRate: 6.9,
          monthlyPayment: 45000,
          originalBalance: 2800000,
          lender: "Toyota Financial Services",
        },
      },
    });
    console.log("  ✓ Liability (auto loan)");
  }

  // ── 8. Transactions (~130, 90 days, dense for heatmap) ───────────────────────
  const txnCount = await db.transaction.count({ where: { organizationId: org.id } });
  if (txnCount === 0) {
    type TxRow = [string, string | null, string, bigint, string, number, boolean?];

    // [accountId, merchantName, name, amountCents, category, daysBack, pending?]
    const rows: TxRow[] = [
      // ── Current month (days 0–29) ──
      // Day 0
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      0],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      0],
      // Day 1
      [checking.id, "CVS",               "CVS Pharmacy",                    1850n, "Health & Wellness",  1],
      // Day 2
      [checking.id, "Lyft",              "Lyft",                            2100n, "Travel & Transport", 2],
      // Day 3
      [checking.id, "Whole Foods",       "Whole Foods Market",              7234n, "Food & Dining",      3],
      // Day 4
      [checking.id, "Hulu",              "Hulu",                            1799n, "Subscriptions",      4],
      // Day 5
      [amex.id,     "REI",               "REI Co-op",                      28500n, "Shopping",           5],
      // Day 6
      [checking.id, "Uber Eats",         "Uber Eats",                       3480n, "Food & Dining",      6],
      // Day 7
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      7],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      7],
      // Day 8 — no spend
      // Day 9
      [amex.id,     "Apple",             "Apple Store — MacBook Air",     149_999n, "Shopping",           9],
      // Day 10
      [checking.id, "AT&T",              "AT&T Wireless",                   8500n, "Bills & Utilities",  10],
      // Day 11
      [checking.id, "Trader Joe's",      "Trader Joe's",                    6950n, "Food & Dining",      11],
      // Day 12
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      12],
      [checking.id, "Shell",             "Shell Gas Station",               5900n, "Travel & Transport", 12],
      // Day 13
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      13],
      // Day 14
      [checking.id, "Planet Fitness",    "Planet Fitness",                  2500n, "Health & Wellness",  14],
      [checking.id, "Walgreens",         "Walgreens Pharmacy",              1850n, "Health & Wellness",  14],
      // Day 15
      [amex.id,     "Sushi Nakazawa",    "Sushi Nakazawa",                 18500n, "Food & Dining",      15],
      // Day 16 — no spend
      // Day 17
      [checking.id, "PG&E",              "PG&E Electric Bill",              9200n, "Bills & Utilities",  17],
      // Day 18
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      18],
      [checking.id, "Sweetgreen",        "Sweetgreen",                      1680n, "Food & Dining",      18],
      // Day 19
      [checking.id, "Spotify",           "Spotify",                          999n, "Subscriptions",      19],
      // Day 20
      [amex.id,     "Anthropic",         "Anthropic Claude Pro",            2000n, "Subscriptions",      20],
      // Day 21
      [checking.id, "Shell",             "Shell Gas Station",               5900n, "Travel & Transport", 21],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      21],
      // Day 22
      [checking.id, "Netflix",           "Netflix",                         1549n, "Subscriptions",      22],
      [amex.id,     "Amazon",            "Amazon.com",                      6799n, "Shopping",           22],
      // Day 23
      [checking.id, "Costco",            "Costco Wholesale",               18650n, "Shopping",           23],
      // Day 24
      [checking.id, "Whole Foods",       "Whole Foods Market",              8734n, "Food & Dining",      24],
      // Day 25 — no spend
      // Day 26
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      26],
      // Day 27
      [checking.id, "Riverside Apts",    "Rent Payment",                  180000n, "Bills & Utilities",  27],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      27],
      // Day 28
      [checking.id, "Employer Inc.",     "Direct Deposit — Payroll",     -720000n, "Income",             28],
      // Day 29
      [checking.id, "Lyft",              "Lyft",                            2100n, "Travel & Transport", 29],
      // Day 30
      [checking.id, "Walgreens",         "Walgreens Pharmacy",              1200n, "Health & Wellness",  30],

      // ── Month 2 (days 31–60) ──
      [checking.id, "Employer Inc.",     "Bonus — Q2",                   -250000n, "Income",             31],
      [savings.id,  null,                "Interest Earned",                  -890n, "Income",             32],
      [amex.id,     "Amazon",            "Amazon.com",                      4320n, "Shopping",           33],
      [checking.id, "Hulu",              "Hulu",                            1799n, "Subscriptions",      34],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      35],
      [checking.id, "Sweetgreen",        "Sweetgreen",                      1680n, "Food & Dining",      35],
      [amex.id,     "REI",               "REI Co-op",                       2850n, "Shopping",           36],
      // Day 37 — no spend
      [checking.id, "CVS",               "CVS Pharmacy",                    3125n, "Health & Wellness",  38],
      [checking.id, "Lyft",              "Lyft",                            1890n, "Travel & Transport", 38],
      [checking.id, "AT&T",              "AT&T Wireless",                   8500n, "Bills & Utilities",  39],
      [checking.id, "Trader Joe's",      "Trader Joe's",                    8150n, "Food & Dining",      40],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      41],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      41],
      // Day 42 — no spend
      [checking.id, "Planet Fitness",    "Planet Fitness",                  2500n, "Health & Wellness",  43],
      [amex.id,     "Best Buy",          "Best Buy",                       62499n, "Shopping",           44],
      [checking.id, "Sweetgreen",        "Sweetgreen",                      1680n, "Food & Dining",      45],
      [checking.id, "Employer Inc.",     "Direct Deposit — Payroll",     -720000n, "Income",             46],
      [checking.id, "PG&E",              "PG&E Electric Bill",              8920n, "Bills & Utilities",  47],
      // Day 48 — no spend
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      49],
      [checking.id, "Spotify",           "Spotify",                          999n, "Subscriptions",      50],
      [amex.id,     "United",            "United Airlines",                28900n, "Travel & Transport", 51],
      [checking.id, "Whole Foods",       "Whole Foods Market",             11840n, "Food & Dining",      52],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      53],
      [checking.id, "Shell",             "Shell Gas Station",               6200n, "Travel & Transport", 54],
      [checking.id, "Lyft",              "Lyft",                            1890n, "Travel & Transport", 54],
      [amex.id,     "Nordstrom",         "Nordstrom",                      38500n, "Shopping",           55],
      [checking.id, "Netflix",           "Netflix",                         1549n, "Subscriptions",      56],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      57],
      [checking.id, "Riverside Apts",    "Rent Payment",                  180000n, "Bills & Utilities",  58],
      [amex.id,     "Amazon",            "Amazon.com",                      8420n, "Shopping",           59],
      [checking.id, "Trader Joe's",      "Trader Joe's",                    7850n, "Food & Dining",      60],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      60],

      // ── Month 3 (days 61–90) ──
      [savings.id,  null,                "Interest Earned",                  -820n, "Income",             62],
      [checking.id, "Costco",            "Costco Wholesale",               22450n, "Shopping",           63],
      [checking.id, "Whole Foods",       "Whole Foods Market",              9234n, "Food & Dining",      64],
      // Day 64 — no spend
      [checking.id, "AT&T",              "AT&T Wireless",                   8500n, "Bills & Utilities",  65],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      65],
      [checking.id, "Walgreens",         "Walgreens Pharmacy",              4280n, "Health & Wellness",  66],
      [amex.id,     "Apple",             "Apple App Store",                 1499n, "Subscriptions",      67],
      [checking.id, "Uber",              "Uber",                            2340n, "Travel & Transport", 68],
      // Day 69 — no spend
      [checking.id, "Lyft",              "Lyft",                            2340n, "Travel & Transport", 70],
      [checking.id, "Trader Joe's",      "Trader Joe's",                    7360n, "Food & Dining",      71],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      72],
      [checking.id, "Planet Fitness",    "Planet Fitness",                  2500n, "Health & Wellness",  73],
      [amex.id,     "Amazon",            "Amazon.com",                      8420n, "Shopping",           74],
      [checking.id, "Shell",             "Shell Gas Station",               6200n, "Travel & Transport", 75],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      75],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      76],
      [checking.id, "PG&E",              "PG&E Electric Bill",              9850n, "Bills & Utilities",  77],
      [checking.id, "Spotify",           "Spotify",                          999n, "Subscriptions",      78],
      [amex.id,     "Zara",              "Zara",                           15800n, "Shopping",           79],
      // Day 80 — no spend
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      81],
      [checking.id, "Sweetgreen",        "Sweetgreen",                      1680n, "Food & Dining",      81],
      // Day 82 — no spend
      [checking.id, "Netflix",           "Netflix",                         1549n, "Subscriptions",      83],
      [checking.id, "Chipotle",          "Chipotle Mexican Grill",          1285n, "Food & Dining",      84],
      [checking.id, "Uber",              "Uber",                            2340n, "Travel & Transport", 85],
      [amex.id,     "Delta",             "Delta Airlines",                 42500n, "Travel & Transport", 85],
      [checking.id, "Hulu",              "Hulu",                            1799n, "Subscriptions",      86],
      [checking.id, "Starbucks",         "Starbucks",                        685n, "Food & Dining",      87],
      [checking.id, "Riverside Apts",    "Rent Payment",                  180000n, "Bills & Utilities",  88],
      [checking.id, "Employer Inc.",     "Direct Deposit — Payroll",     -720000n, "Income",             89],
      [savings.id,  null,                "Interest Earned",                  -820n, "Income",             90],

      // Pending transaction
      [amex.id,     "Amazon",            "Amazon.com — Pending",            6799n, "Shopping",            0, true],
    ];

    await db.transaction.createMany({
      data: rows.map(([acctId, merchant, name, amount, category, days, pending]) => ({
        financialAccountId: acctId as string,
        organizationId: org.id,
        amount: amount as bigint,
        isoCurrencyCode: "USD",
        date: daysAgo(days as number),
        name: name as string,
        merchantName: merchant as string | null,
        customCategory: category as string,
        pending: (pending as boolean | undefined) ?? false,
      })),
    });
    console.log(`  ✓ Transactions (${rows.length} across 90 days — dense for heatmap)`);
  }

  // ── 9. Goals ─────────────────────────────────────────────────────────────────
  const goalCount = await db.goal.count({ where: { organizationId: org.id } });
  if (goalCount === 0) {
    await db.goal.createMany({
      data: [
        {
          organizationId: org.id, userId: demo.id,
          name: "Emergency Fund (6 months)",
          targetAmount: 3_600_000n, currentAmount: 1_843_000n,
          targetDate: futureDate(18), contributionRate: 50000,
          linkedAccountIds: [savings.id], isCompleted: false,
        },
        {
          organizationId: org.id, userId: demo.id,
          name: "House Down Payment (20%)",
          targetAmount: 12_000_000n, currentAmount: 2_685_000n,
          targetDate: futureDate(8), contributionRate: 100000,
          linkedAccountIds: [savings.id, checking.id], isCompleted: false,
        },
        {
          organizationId: org.id, userId: demo.id,
          name: "Max Roth IRA ($7,000)",
          targetAmount: 700_000n, currentAmount: 475_000n,
          targetDate: new Date(new Date().getFullYear(), 11, 31),
          contributionRate: 50000, linkedAccountIds: [ira.id], isCompleted: false,
        },
        {
          organizationId: org.id, userId: demo.id,
          name: "Japan Trip Fund",
          targetAmount: 500_000n, currentAmount: 520_000n,
          targetDate: daysAgo(30), contributionRate: 0,
          linkedAccountIds: [], isCompleted: true,
        },
        {
          organizationId: org.id, userId: demo.id,
          name: "Pay Off Auto Loan",
          targetAmount: 1_420_000n, currentAmount: 180_000n,
          targetDate: futureDate(24), contributionRate: 60000,
          linkedAccountIds: [], isCompleted: false,
        },
      ],
    });
    console.log("  ✓ Goals (5 — on track, at risk, in progress, completed)");
  }

  // ── 10. Budget (current month) ───────────────────────────────────────────────
  const now = new Date();
  const hasBudget = await db.budget.findFirst({
    where: { organizationId: org.id, userId: demo.id, month: now.getMonth() + 1, year: now.getFullYear() },
  });
  if (!hasBudget) {
    const budget = await db.budget.create({
      data: {
        organizationId: org.id, userId: demo.id,
        name: "Monthly Budget",
        month: now.getMonth() + 1, year: now.getFullYear(),
        rollover: false,
      },
    });
    await db.budgetCategory.createMany({
      data: [
        { budgetId: budget.id, category: "Food & Dining",      limitAmount:  80_000n, spentAmount:  50_868n }, // 64%
        { budgetId: budget.id, category: "Shopping",           limitAmount: 100_000n, spentAmount: 191_798n }, // 192% — OVER (MacBook!)
        { budgetId: budget.id, category: "Bills & Utilities",  limitAmount:  40_000n, spentAmount:  36_200n }, // 91% — near limit
        { budgetId: budget.id, category: "Subscriptions",      limitAmount:  15_000n, spentAmount:   6_347n }, // 42%
        { budgetId: budget.id, category: "Travel & Transport", limitAmount:  30_000n, spentAmount:   8_000n }, // 27%
        { budgetId: budget.id, category: "Health & Wellness",  limitAmount:  20_000n, spentAmount:   6_850n }, // 34%
        { budgetId: budget.id, category: "Entertainment",      limitAmount:  20_000n, spentAmount:       0n }, // 0%
        { budgetId: budget.id, category: "Income",             limitAmount:       0n, spentAmount:       0n },
      ],
    });
    console.log("  ✓ Budget (Shopping 192% over due to MacBook — great demo!)");
  }

  // ── 11. Net worth snapshots (12 months of growth) ───────────────────────────
  const snapRows = [
    { mAgo: 11, assets: 51_200_00n, liabs: 18_500_00n },
    { mAgo: 10, assets: 53_800_00n, liabs: 18_100_00n },
    { mAgo:  9, assets: 55_200_00n, liabs: 17_600_00n },
    { mAgo:  8, assets: 57_400_00n, liabs: 17_200_00n },
    { mAgo:  7, assets: 58_900_00n, liabs: 16_900_00n },
    { mAgo:  6, assets: 60_500_00n, liabs: 16_600_00n },
    { mAgo:  5, assets: 62_800_00n, liabs: 16_200_00n },
    { mAgo:  4, assets: 64_900_00n, liabs: 15_900_00n },
    { mAgo:  3, assets: 67_100_00n, liabs: 15_700_00n },
    { mAgo:  2, assets: 70_400_00n, liabs: 15_500_00n },
    { mAgo:  1, assets: 72_800_00n, liabs: 15_200_00n },
    { mAgo:  0, assets: 75_527_50n, liabs: 14_200_00n }, // today ~$61k net worth
  ];

  for (const snap of snapRows) {
    const snapDate = monthsAgo(snap.mAgo);
    await db.netWorthSnapshot.upsert({
      where: { organizationId_userId_snapshotDate: { organizationId: org.id, userId: demo.id, snapshotDate: snapDate } },
      update: {},
      create: {
        organizationId: org.id, userId: demo.id,
        totalAssets: snap.assets, totalLiabilities: snap.liabs,
        netWorth: snap.assets - snap.liabs,
        snapshotDate: snapDate,
        breakdown: { checking: 624_75, savings: 18_430_00, investment: 53_295_00, credit: 1_248_36, loan: 14_200_00 },
      },
    });
  }
  console.log("  ✓ Net worth snapshots (12 months, $32.6k → $61.3k — strong uptrend)");

  // ── 12. Credit ───────────────────────────────────────────────────────────────
  const hasCreditScores = await db.creditScore.count({ where: { organizationId: org.id, userId: demo.id } });
  if (hasCreditScores === 0) {
    for (const { dAgo, score } of [
      { dAgo: 150, score: 718 }, { dAgo: 120, score: 724 },
      { dAgo:  90, score: 729 }, { dAgo:  60, score: 733 },
      { dAgo:  30, score: 738 }, { dAgo:   0, score: 742 },
    ]) {
      const scoreDate = new Date();
      scoreDate.setDate(scoreDate.getDate() - dAgo);
      scoreDate.setHours(0, 0, 0, 0);
      await db.creditScore.create({
        data: {
          organizationId: org.id, userId: demo.id,
          score, scoreDate,
          paymentHistory: 99, creditUtilization: 14,
          creditAge: 82, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7,
        },
      });
    }

    await db.creditAccount.createMany({
      data: [
        {
          organizationId: org.id, userId: demo.id,
          accountName: "Amex Gold Card", accountType: "credit_card",
          accountNumber: "****3456", creditor: "American Express",
          balance: 1_248_36n, creditLimit: 25_000_00n, accountStatus: "open", paymentStatus: "current",
          openDate: new Date("2019-03-15"), lastPaymentDate: daysAgo(5), nextPaymentDue: dateFromNow(25),
        },
        {
          organizationId: org.id, userId: demo.id,
          accountName: "Chase Sapphire Preferred", accountType: "credit_card",
          accountNumber: "****7890", creditor: "Chase Bank",
          balance: 0n, creditLimit: 15_000_00n, accountStatus: "open", paymentStatus: "current",
          openDate: new Date("2020-07-22"), lastPaymentDate: daysAgo(3), nextPaymentDue: dateFromNow(27),
        },
        {
          organizationId: org.id, userId: demo.id,
          accountName: "Toyota Auto Loan", accountType: "auto_loan",
          accountNumber: "****5678", creditor: "Toyota Financial Services",
          balance: 14_200_00n, creditLimit: 28_000_00n, accountStatus: "open", paymentStatus: "current",
          monthlyPayment: 45000n,
          openDate: new Date("2022-01-10"), lastPaymentDate: daysAgo(8), nextPaymentDue: dateFromNow(22),
        },
      ],
    });

    // Credit history events
    const creditAccounts = await db.creditAccount.findMany({ where: { organizationId: org.id, userId: demo.id } });
    const amexCreditAcct = creditAccounts.find(a => a.accountName === "Amex Gold Card");
    const chaseCreditAcct = creditAccounts.find(a => a.accountName === "Chase Sapphire Preferred");

    if (amexCreditAcct && chaseCreditAcct) {
      await db.creditHistory.createMany({
        data: [
          {
            organizationId: org.id, userId: demo.id,
            creditAccountId: amexCreditAcct.id,
            eventType: "payment", eventDate: daysAgo(5),
            eventDescription: "On-time payment of $1,248.36 received",
            metadata: { amount: 124836, onTime: true },
          },
          {
            organizationId: org.id, userId: demo.id,
            creditAccountId: amexCreditAcct.id,
            eventType: "utilization_decrease", eventDate: daysAgo(35),
            eventDescription: "Credit utilization decreased from 22% to 14%",
            metadata: { oldUtilization: 22, newUtilization: 14 },
          },
          {
            organizationId: org.id, userId: demo.id,
            creditAccountId: chaseCreditAcct.id,
            eventType: "payment", eventDate: daysAgo(3),
            eventDescription: "Statement balance paid in full — $0.00 remaining",
            metadata: { amount: 0, onTime: true, paidInFull: true },
          },
          {
            organizationId: org.id, userId: demo.id,
            creditAccountId: amexCreditAcct.id,
            eventType: "score_increase", eventDate: daysAgo(30),
            eventDescription: "Credit score increased by 5 points (733 → 738)",
            metadata: { oldScore: 733, newScore: 738 },
          },
        ],
      });
    }
    console.log("  ✓ Credit (718→742 trend, 3 accounts, payment history)");
  }

  // ── 13. Debt accounts + payoff strategies ────────────────────────────────────
  const hasDebt = await db.debtAccount.count({ where: { organizationId: org.id } });
  if (hasDebt === 0) {
    const autoDebt = await db.debtAccount.create({
      data: {
        organizationId: org.id, userId: demo.id,
        accountName: "Toyota Auto Loan",
        accountType: "auto_loan",
        currentBalance: 1_420_000n,
        minimumPayment: 45_000n,
        interestRate: 6.9,
      },
    });
    const ccDebt = await db.debtAccount.create({
      data: {
        organizationId: org.id, userId: demo.id,
        accountName: "Amex Gold Card",
        accountType: "credit_card",
        currentBalance: 124_836n,
        minimumPayment: 3_500n,
        interestRate: 24.99,
      },
    });
    const studentDebt = await db.debtAccount.create({
      data: {
        organizationId: org.id, userId: demo.id,
        accountName: "Federal Student Loan",
        accountType: "student_loan",
        currentBalance: 2_250_000n,
        minimumPayment: 24_500n,
        interestRate: 5.5,
      },
    });

    // Avalanche strategy for auto loan (highest rate first = credit card actually, but demo auto)
    const autoSchedule = buildSchedule(1_420_000, 6.9, 65_000, 36);
    await db.payoffStrategy.create({
      data: {
        organizationId: org.id, userId: demo.id,
        debtAccountId: autoDebt.id,
        strategyType: "avalanche",
        monthlyPaymentAmount: 65_000n,
        projectedPayoffMonths: autoSchedule.length,
        totalInterestPaid: BigInt(autoSchedule.reduce((s, r) => s + r.interest, 0)),
        payoffDate: futureDate(autoSchedule.length),
        schedule: autoSchedule,
      },
    });

    // Snowball strategy for credit card (smallest balance first)
    const ccSchedule = buildSchedule(124_836, 24.99, 15_000, 24);
    await db.payoffStrategy.create({
      data: {
        organizationId: org.id, userId: demo.id,
        debtAccountId: ccDebt.id,
        strategyType: "snowball",
        monthlyPaymentAmount: 15_000n,
        projectedPayoffMonths: ccSchedule.length,
        totalInterestPaid: BigInt(ccSchedule.reduce((s, r) => s + r.interest, 0)),
        payoffDate: futureDate(ccSchedule.length),
        schedule: ccSchedule,
      },
    });

    // Active payoff plan for student loan
    const studentSchedule = buildSchedule(2_250_000, 5.5, 35_000, 84);
    await db.payoffPlan.create({
      data: {
        organizationId: org.id, userId: demo.id,
        debtAccountId: studentDebt.id,
        strategyType: "avalanche",
        monthlyPaymentAmount: 35_000n,
        startDate: daysAgo(0),
        projectedPayoffDate: futureDate(studentSchedule.length),
        isActive: true,
      },
    });

    console.log("  ✓ Debt (auto loan $14.2k, credit card $1.25k, student loan $22.5k + payoff strategies)");
  }

  // ── 14. Alert rules + history ────────────────────────────────────────────────
  const hasAlerts = await db.alertRule.count({ where: { organizationId: org.id } });
  if (hasAlerts === 0) {
    const alert1 = await db.alertRule.create({
      data: {
        organizationId: org.id, userId: demo.id,
        name: "Large Transaction Alert",
        ruleType: "large_transaction",
        conditionType: "greater_than",
        threshold: 50_000n,
        isEnabled: true, notificationMethod: "in_app",
      },
    });
    const alert2 = await db.alertRule.create({
      data: {
        organizationId: org.id, userId: demo.id,
        name: "Shopping Budget Breach",
        ruleType: "budget_breach",
        conditionType: "percentage_increase",
        threshold: 10000n, // 100%
        isEnabled: true, notificationMethod: "both",
        metadata: { category: "Shopping" },
      },
    });
    const alert3 = await db.alertRule.create({
      data: {
        organizationId: org.id, userId: demo.id,
        name: "Low Checking Balance",
        ruleType: "spending_threshold",
        conditionType: "less_than",
        threshold: 200_000n, // $2,000
        isEnabled: true, notificationMethod: "in_app",
      },
    });
    const alert4 = await db.alertRule.create({
      data: {
        organizationId: org.id, userId: demo.id,
        name: "Monthly Spend > $3,500",
        ruleType: "spending_threshold",
        conditionType: "greater_than",
        threshold: 350_000n,
        isEnabled: false, notificationMethod: "email",
      },
    });

    // Alert history — realistic past triggers
    await db.alertHistory.createMany({
      data: [
        {
          alertRuleId: alert1.id, organizationId: org.id, userId: demo.id,
          triggerValue: 149_999n,
          message: "Large transaction detected: Apple Store — MacBook Air for $1,499.99 on your Amex Gold Card.",
          wasViewed: false, triggeredAt: daysAgo(9),
        },
        {
          alertRuleId: alert2.id, organizationId: org.id, userId: demo.id,
          triggerValue: 191_798n,
          message: "Shopping budget breached! You've spent $1,917.98 (192%) against a $1,000 monthly limit.",
          wasViewed: false, triggeredAt: daysAgo(9),
        },
        {
          alertRuleId: alert1.id, organizationId: org.id, userId: demo.id,
          triggerValue: 62_499n,
          message: "Large transaction detected: Best Buy purchase for $624.99 on your Amex Gold Card.",
          wasViewed: true, triggeredAt: daysAgo(44),
        },
        {
          alertRuleId: alert1.id, organizationId: org.id, userId: demo.id,
          triggerValue: 42_500n,
          message: "Large transaction detected: Delta Airlines for $425.00 on your Amex Gold Card.",
          wasViewed: true, triggeredAt: daysAgo(85),
        },
        {
          alertRuleId: alert3.id, organizationId: org.id, userId: demo.id,
          triggerValue: 180_000n,
          message: "Heads up: rent payment of $1,800 was processed, leaving your checking balance temporarily low.",
          wasViewed: true, triggeredAt: daysAgo(27),
        },
      ],
    });
    console.log("  ✓ Alert rules (4 rules, 5 history events — 2 unread for demo)");
  }

  // ── 15. Insights ─────────────────────────────────────────────────────────────
  const hasInsights = await db.insight.count({ where: { organizationId: org.id } });
  if (hasInsights === 0) {
    await db.insight.createMany({
      data: [
        {
          organizationId: org.id, userId: demo.id,
          type: "financial_health_report",
          title: "May 2026 Financial Health Report",
          severity: "warning",
          body: "Your overall financial health score is 72/100. You're making strong progress on savings and credit improvement, but this month's shopping spending significantly exceeded budget due to the MacBook purchase. Your house down payment goal is at risk given the current savings rate.",
          actionItems: [
            "Redirect $500/month from discretionary spending to house down payment fund",
            "Consider pausing non-essential subscriptions — you have $120.94/month in recurring charges",
            "Your credit score hit 742 — explore refinancing the auto loan at a lower rate",
            "Set up automatic credit card payments to protect your 99% payment history",
          ],
          metadata: {
            healthScore: 72,
            concerns: [
              { title: "Shopping Budget Exceeded by 92%", detail: "MacBook Air purchase pushed shopping to $1,917.98 — $917.98 over the $1,000 budget. One-time purchases can skew monthly views.", severity: "critical" },
              { title: "House Down Payment Goal At Risk", detail: "At the current $1,000/month contribution rate, you'll accumulate ~$8,000 by your target date, leaving a $31,000 shortfall.", severity: "warning" },
            ],
            strengths: [
              { title: "Credit Score Improving Steadily", detail: "Up 24 points over 5 months (718 → 742). You're approaching 'Very Good' territory which could unlock better loan rates." },
              { title: "Consistent Emergency Fund Growth", detail: "Marcus Savings is at $18,430, which represents ~1.5 months of expenses. You're halfway to your 6-month target." },
              { title: "Investment Portfolio Up 22%", detail: "Total unrealized gains of $13,251 across IRA and brokerage. NVDA is your top performer at +$1,810." },
            ],
            recommendations: [
              { title: "Increase Down Payment Contribution to $1,500/mo", detail: "Reduce dining out and entertainment budgets by $500 combined. Automate the transfer on payroll day.", priority: "high" },
              { title: "Audit Recurring Subscriptions", detail: "You have 7 detected recurring charges totaling ~$121/month. Review whether you actively use all of them.", priority: "medium" },
              { title: "Refinance Auto Loan", detail: "With a 742 credit score, you may qualify for 4.5–5.5% APR, down from 6.9%. Could save $800+ in interest.", priority: "medium" },
              { title: "Max Out Roth IRA Before Year End", detail: "You're at $4,750 of the $7,000 limit. Need $2,250 more before Dec 31.", priority: "low" },
            ],
          },
          toolCallLog: [{ tool: "get_recurring_subscriptions", result: "7 subscriptions found" }, { tool: "get_goal_progress", result: "5 goals analyzed" }],
          modelId: "claude-sonnet-4-6",
          promptHash: "demo-health-report-hash",
          inputTokens: 2840, outputTokens: 920,
          generatedAt: daysAgo(1),
          expiresAt: futureDate(1),
        },
        {
          organizationId: org.id, userId: demo.id,
          type: "subscription_audit",
          title: "7 Recurring Subscriptions Found — $120.94/month",
          severity: "info",
          body: "We detected 7 recurring charges totaling $120.94/month ($1,451/year). Netflix, Spotify, Hulu, and Planet Fitness account for $64.47/month. AT&T Wireless is your largest single recurring charge at $85/month. Consider auditing whether you actively use all streaming services.",
          actionItems: [
            "Review Netflix ($15.49), Hulu ($17.99), and any other streaming overlap",
            "Starbucks visits are running at ~$6.85 per visit, 3–4 times per week (~$109/month)",
            "Shell gas station charges average $59/month — consider a cash-back gas card",
          ],
          metadata: Prisma.DbNull,
          toolCallLog: [{ tool: "get_recurring_subscriptions", result: "7 found" }],
          modelId: "claude-sonnet-4-6",
          promptHash: "demo-subscription-hash",
          inputTokens: 1240, outputTokens: 480,
          generatedAt: daysAgo(3),
          expiresAt: futureDate(4),
        },
        {
          organizationId: org.id, userId: demo.id,
          type: "spending_anomaly",
          title: "Unusual Spending Pattern: Dining Up 38% This Month",
          severity: "warning",
          body: "Your Food & Dining spending of $508.68 this month is 38% above your 3-month average of $368.42. This is driven by a $185 dinner at Sushi Nakazawa and 3 Uber Eats orders. Your grocery spending at Trader Joe's and Whole Foods remains consistent with prior months.",
          actionItems: [
            "Limit restaurant spending to 2 dinners out per month (~$80 budget)",
            "Meal prep on Sundays to reduce Uber Eats orders (avg $34/order)",
            "Grocery spending is healthy — Trader Joe's and Whole Foods together average $160/month",
          ],
          metadata: Prisma.DbNull,
          toolCallLog: [{ tool: "get_spending_by_category", result: "anomaly detected in Food & Dining" }],
          modelId: "claude-sonnet-4-6",
          promptHash: "demo-anomaly-hash",
          inputTokens: 980, outputTokens: 360,
          generatedAt: daysAgo(5),
          expiresAt: futureDate(2),
        },
      ],
    });
    console.log("  ✓ Insights (health report + subscription audit + spending anomaly)");
  }

  // ── 16. Spending forecast ────────────────────────────────────────────────────
  const hasForecast = await db.spendingForecast.count({ where: { organizationId: org.id } });
  if (hasForecast === 0) {
    const forecastStart = new Date();
    forecastStart.setDate(1);
    const forecastEnd = new Date(forecastStart);
    forecastEnd.setMonth(forecastEnd.getMonth() + 1);

    // Generate 30-day forecast data points
    const forecastDays = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(forecastStart);
      d.setDate(d.getDate() + i);
      const baseline = 28_000; // ~$280/day average
      const isRentDay = i === 0;
      const amount = isRentDay ? 185_000 : Math.round(baseline * (0.7 + Math.random() * 0.6));
      return {
        date: d.toISOString().split("T")[0],
        amount,
        lower_bound: Math.round(amount * 0.7),
        upper_bound: Math.round(amount * 1.3),
      };
    });

    await db.spendingForecast.create({
      data: {
        organizationId: org.id, userId: demo.id,
        forecastType: "monthly",
        category: null,
        forecastStartDate: forecastStart,
        forecastEndDate: forecastEnd,
        predictedAmount: BigInt(forecastDays.reduce((s, d) => s + d.amount, 0)),
        confidenceScore: 0.78,
        dataPoints: 90,
        forecast: forecastDays,
        methodology: "linear_regression",
      },
    });
    console.log("  ✓ Spending forecast (30-day monthly, 78% confidence)");
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           FinVerse Demo — All Features Covered!              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  URL      : http://localhost:3000                            ║
║  Email    : demo@finverse.app                                ║
║  Password : Demo@2024                                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  FEATURE COVERAGE                                            ║
║                                                              ║
║  Dashboard   7 accounts  · net worth $61.3k                  ║
║  Portfolio   11 holdings · $13.3k unrealized gains           ║
║  Credit      742 score   · 718→742 uptrend over 5 months     ║
║  Goals       5 goals     · 1 completed, 1 at risk            ║
║  Budgets     Shopping 192% over (MacBook) · 8 categories     ║
║  Heatmap     130 txns    · rich daily pattern, clear peaks   ║
║  Recurring   8 detected  · Netflix, Spotify, AT&T + habits  ║
║  Debt        3 debts     · payoff strategies ready           ║
║  Alerts      4 rules     · 2 unread (MacBook triggered!)     ║
║  Forecast    30-day      · 78% confidence, generated         ║
║  Tax         ~$13.3k unrealised gains · income pre-filled    ║
║  Insights    3 insights  · health report, subs, anomaly      ║
║                                                              ║
║  Viewer account: viewer@finverse.app / Demo@2024             ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
