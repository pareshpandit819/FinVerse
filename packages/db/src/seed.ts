/**
 * Demo seed — rich, realistic financial data for professor demo.
 *
 * CREDENTIALS
 * ──────────────────────────────────────────────
 *   Email   : demo@finverse.app
 *   Password: Demo@2024
 * ──────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client";
import { encryptMfaSecret } from "@repo/shared/crypto";
import { generateTotpSecret } from "@repo/shared/totp";

// bcrypt.hash("Demo@2024", 12) — pre-computed so the seed has no runtime bcrypt dep
const DEMO_PASSWORD_HASH =
  "$2b$12$uiKsFfPpfhTa.k4.JVcpYOI7ajph9IiwvOcoyWL.5NO9kMNyDe9Eu";

const db = new PrismaClient({ log: ["warn", "error"] });

// ─── helpers ────────────────────────────────────────────────────────────────
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
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n🌱  Seeding FinVerse demo database…\n");

  // ── 1. Organisation ────────────────────────────────────────────────────────
  const org = await db.organization.upsert({
    where:  { slug: "johnson-household" },
    update: {},
    create: { name: "Johnson Household", slug: "johnson-household" },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // ── 2. Demo user (with password) ──────────────────────────────────────────
  const demo = await db.user.upsert({
    where:  { email: "demo@finverse.app" },
    update: { password: DEMO_PASSWORD_HASH, name: "Alex Johnson" },
    create: {
      email:           "demo@finverse.app",
      name:            "Alex Johnson",
      password:        DEMO_PASSWORD_HASH,
      emailVerifiedAt: new Date(),
    },
  });

  // Viewer account (read-only, for showing role-based access)
  const viewer = await db.user.upsert({
    where:  { email: "viewer@finverse.app" },
    update: { password: DEMO_PASSWORD_HASH },
    create: {
      email:           "viewer@finverse.app",
      name:            "Sam Viewer",
      password:        DEMO_PASSWORD_HASH,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("  ✓ Users: demo@finverse.app / Demo@2024");

  // ── 3. Memberships ────────────────────────────────────────────────────────
  await db.membership.upsert({
    where:  { organizationId_userId: { organizationId: org.id, userId: demo.id } },
    update: {},
    create: { organizationId: org.id, userId: demo.id, role: "OWNER" },
  });
  await db.membership.upsert({
    where:  { organizationId_userId: { organizationId: org.id, userId: viewer.id } },
    update: {},
    create: { organizationId: org.id, userId: viewer.id, role: "VIEWER" },
  });
  console.log("  ✓ Memberships");

  // ── 4. MFA (pre-enrolled for demo user) ──────────────────────────────────
  const hasMfa = await db.mfaSecret.findFirst({ where: { userId: demo.id, verified: true } });
  if (!hasMfa) {
    const { secret } = generateTotpSecret(demo.email);
    await db.mfaSecret.create({
      data: { userId: demo.id, encryptedSecret: encryptMfaSecret(secret), verified: true },
    });
  }
  console.log("  ✓ MFA enrolled");

  // ── 5. Financial accounts ─────────────────────────────────────────────────
  async function findOrCreate(name: string, type: string, balanceCents: bigint, currency = "USD") {
    const existing = await db.financialAccount.findFirst({
      where: { organizationId: org.id, name },
    });
    if (existing) return existing;
    return db.financialAccount.create({
      data: { organizationId: org.id, userId: demo.id, name, type, balanceCurrent: balanceCents, isoCurrencyCode: currency },
    });
  }

  const checking   = await findOrCreate("Chase Checking",      "checking",    624750n);    // $6,247.50
  const savings    = await findOrCreate("Marcus Savings",      "savings",    1843000n);   // $18,430.00
  const creditAmex = await findOrCreate("Amex Gold Card",      "credit_card", 124836n);   // $1,248.36
  const ira        = await findOrCreate("Fidelity Roth IRA",   "investment", 4285000n);   // $42,850.00
  const carLoan    = await findOrCreate("Toyota Auto Loan",    "loan",       1420000n);   // $14,200.00

  // Use .id strings for transaction helper
  const chk = checking.id;
  const sav = savings.id;
  const cc  = creditAmex.id;

  console.log("  ✓ Financial accounts (checking, savings, credit, IRA, auto loan)");

  // ── 6. Transactions (90 days — realistic spending story) ──────────────────
  const txnCount = await db.transaction.count({ where: { organizationId: org.id } });
  if (txnCount === 0) {

    // Helper to create transaction
    const txn = (
      acctId: string,
      name: string,
      merchant: string | null,
      amountCents: bigint,
      category: string,
      daysBack: number,
      pending = false
    ) =>
      db.transaction.create({
        data: {
          financialAccountId: acctId,
          organizationId: org.id,
          amount: amountCents,
          isoCurrencyCode: "USD",
          date: daysAgo(daysBack),
          name,
          merchantName: merchant,
          customCategory: category,
          pending,
        },
      });

    // Month 3 (oldest — 60–90 days ago)
    await Promise.all([
      txn(chk, "Direct Deposit — Payroll",  "Employer Inc.",       -720_000n, "Income",            88),
      txn(chk, "Rent Payment",               "Riverside Apts",       180_000n, "Bills & Utilities", 87),
      txn(chk, "Whole Foods Market",         "Whole Foods",           9_234n,  "Food & Dining",     86),
      txn(cc,"Delta Airlines",            "Delta",                42_500n,  "Travel & Transport", 85),
      txn(chk, "Netflix",                    "Netflix",               1_549n,  "Subscriptions",     83),
      txn(chk, "Starbucks",                  "Starbucks",               685n,  "Food & Dining",     82),
      txn(chk, "Shell Gas Station",          "Shell",                 6_200n,  "Travel & Transport", 80),
      txn(cc,"Zara",                      "Zara",                 15_800n,  "Shopping",          79),
      txn(chk, "Spotify",                    "Spotify",               9_99n,   "Subscriptions",     78),
      txn(chk, "PG&E Electric Bill",         "PG&E",                  9_850n,  "Bills & Utilities", 77),
      txn(chk, "Chipotle Mexican Grill",     "Chipotle",              1_285n,  "Food & Dining",     75),
      txn(cc,"Amazon.com",                "Amazon",                8_420n,  "Shopping",          74),
      txn(chk, "Planet Fitness",             "Planet Fitness",        2_500n,  "Health & Wellness", 73),
      txn(chk, "Trader Joe's",               "Trader Joe's",          7_360n,  "Food & Dining",     71),
      txn(chk, "Uber",                       "Uber",                  2_340n,  "Travel & Transport", 70),
      txn(cc,"Apple App Store",           "Apple",                 1_499n,  "Subscriptions",     68),
      txn(chk, "Walgreens Pharmacy",         "Walgreens",             4_280n,  "Health & Wellness", 66),
      txn(chk, "AT&T Wireless",              "AT&T",                  8_500n,  "Bills & Utilities", 65),
      txn(chk, "Costco Wholesale",           "Costco",               22_450n,  "Shopping",          63),
      txn(sav,  "Interest Earned",            null,                     -820n,  "Income",            62),
    ]);

    // Month 2 (30–60 days ago)
    await Promise.all([
      txn(chk, "Direct Deposit — Payroll",  "Employer Inc.",       -720_000n, "Income",            59),
      txn(chk, "Rent Payment",               "Riverside Apts",       180_000n, "Bills & Utilities", 58),
      txn(chk, "Whole Foods Market",         "Whole Foods",          11_840n,  "Food & Dining",     57),
      txn(chk, "Netflix",                    "Netflix",               1_549n,  "Subscriptions",     56),
      txn(cc,"Nordstrom",                 "Nordstrom",            38_500n,  "Shopping",          55),
      txn(chk, "Shell Gas Station",          "Shell",                 6_800n,  "Travel & Transport", 54),
      txn(chk, "Starbucks",                  "Starbucks",             1_025n,  "Food & Dining",     52),
      txn(cc,"United Airlines",           "United",               28_900n,  "Travel & Transport", 51),
      txn(chk, "Spotify",                    "Spotify",                 999n,  "Subscriptions",     50),
      txn(chk, "PG&E Electric Bill",         "PG&E",                  8_920n,  "Bills & Utilities", 49),
      txn(chk, "Sweetgreen",                 "Sweetgreen",            1_680n,  "Food & Dining",     47),
      txn(cc,"Best Buy",                  "Best Buy",             62_499n,  "Shopping",          46),
      txn(chk, "Planet Fitness",             "Planet Fitness",        2_500n,  "Health & Wellness", 44),
      txn(chk, "Trader Joe's",               "Trader Joe's",          8_150n,  "Food & Dining",     43),
      txn(chk, "Lyft",                       "Lyft",                  1_890n,  "Travel & Transport", 42),
      txn(chk, "AT&T Wireless",              "AT&T",                  8_500n,  "Bills & Utilities", 40),
      txn(chk, "CVS Pharmacy",               "CVS",                   3_125n,  "Health & Wellness", 39),
      txn(chk, "Hulu",                       "Hulu",                  1_799n,  "Subscriptions",     38),
      txn(chk, "Blue Bottle Coffee",         "Blue Bottle",             680n,  "Food & Dining",     36),
      txn(chk, "Amazon.com",                 "Amazon",                4_320n,  "Shopping",          35),
      txn(sav,  "Interest Earned",            null,                     -890n,  "Income",            32),
      txn(chk, "Bonus — Q2",                 "Employer Inc.",       -250_000n, "Income",            31),
    ]);

    // Current month (0–30 days ago)
    await Promise.all([
      txn(chk, "Direct Deposit — Payroll",  "Employer Inc.",       -720_000n, "Income",            28),
      txn(chk, "Rent Payment",               "Riverside Apts",       180_000n, "Bills & Utilities", 27),
      txn(chk, "Whole Foods Market",         "Whole Foods",           8_734n,  "Food & Dining",     24),
      txn(chk, "Netflix",                    "Netflix",               1_549n,  "Subscriptions",     22),
      txn(chk, "Shell Gas Station",          "Shell",                 5_900n,  "Travel & Transport", 21),
      txn(cc,"Anthropic Claude Pro",      "Anthropic",             2_000n,  "Subscriptions",     20),
      txn(chk, "Spotify",                    "Spotify",                 999n,  "Subscriptions",     19),
      txn(chk, "Starbucks",                  "Starbucks",               685n,  "Food & Dining",     18),
      txn(chk, "PG&E Electric Bill",         "PG&E",                  9_200n,  "Bills & Utilities", 17),
      txn(cc,"Sushi Nakazawa",            "Sushi Nakazawa",        18_500n, "Food & Dining",     15),
      txn(chk, "Planet Fitness",             "Planet Fitness",         2_500n,  "Health & Wellness", 14),
      txn(chk, "Chipotle Mexican Grill",     "Chipotle",               1_285n,  "Food & Dining",     12),
      txn(chk, "AT&T Wireless",              "AT&T",                   8_500n,  "Bills & Utilities", 10),
      txn(cc,"Apple Store — MacBook Air", "Apple",               149_999n,  "Shopping",           9),
      txn(chk, "Trader Joe's",               "Trader Joe's",           6_950n,  "Food & Dining",      7),
      txn(chk, "Uber Eats",                  "Uber Eats",              3_480n,  "Food & Dining",      6),
      txn(cc,"REI Co-op",                 "REI",                   28_500n,  "Shopping",           5),
      txn(chk, "Hulu",                       "Hulu",                   1_799n,  "Subscriptions",      4),
      txn(chk, "Whole Foods Market",         "Whole Foods",            7_234n,  "Food & Dining",      3),
      txn(chk, "Lyft",                       "Lyft",                   2_100n,  "Travel & Transport",  2),
      txn(chk, "CVS Pharmacy",               "CVS",                    1_850n,  "Health & Wellness",   1),
      txn(cc,"Amazon.com",                "Amazon",                 6_799n,  "Shopping",            0, true),
    ]);

    console.log("  ✓ Transactions (60 transactions across 3 months)");
  }

  // ── 7. Goals ──────────────────────────────────────────────────────────────
  const goalCount = await db.goal.count({ where: { organizationId: org.id } });
  if (goalCount === 0) {
    await Promise.all([
      // Goal 1: Emergency Fund — on track (50% progress, 2 years out)
      db.goal.create({
        data: {
          organizationId:   org.id,
          userId:           demo.id,
          name:             "Emergency Fund (6 months)",
          targetAmount:     36_000_00n,   // $36,000
          currentAmount:    18_430_00n,   // $18,430 (linked to savings)
          targetDate:       futureDate(18),
          contributionRate: 500_00,       // $500/mo
          linkedAccountIds: [savings.id],
          isCompleted:      false,
        },
      }),
      // Goal 2: House Down Payment — at risk (22% progress, tight deadline)
      db.goal.create({
        data: {
          organizationId:   org.id,
          userId:           demo.id,
          name:             "House Down Payment (20%)",
          targetAmount:     120_000_00n,  // $120,000
          currentAmount:    26_850_00n,   // $26,850
          targetDate:       futureDate(8),
          contributionRate: 1_000_00,     // $1,000/mo
          linkedAccountIds: [savings.id, checking.id],
          isCompleted:      false,
        },
      }),
      // Goal 3: Roth IRA Max — in progress
      db.goal.create({
        data: {
          organizationId:   org.id,
          userId:           demo.id,
          name:             "Max Roth IRA ($7,000)",
          targetAmount:     7_000_00n,    // $7,000
          currentAmount:    4_750_00n,    // $4,750
          targetDate:       new Date(new Date().getFullYear(), 11, 31), // Dec 31
          contributionRate: 500_00,
          linkedAccountIds: [ira.id],
          isCompleted:      false,
        },
      }),
      // Goal 4: Vacation Fund — completed! ✓
      db.goal.create({
        data: {
          organizationId:   org.id,
          userId:           demo.id,
          name:             "Japan Trip Fund",
          targetAmount:     5_000_00n,    // $5,000
          currentAmount:    5_200_00n,    // $5,200
          targetDate:       daysAgo(30),
          contributionRate: 0,
          linkedAccountIds: [],
          isCompleted:      true,
        },
      }),
      // Goal 5: Pay Off Car — in progress
      db.goal.create({
        data: {
          organizationId:   org.id,
          userId:           demo.id,
          name:             "Pay Off Auto Loan",
          targetAmount:     14_200_00n,
          currentAmount:    1_800_00n,    // extra payments so far
          targetDate:       futureDate(24),
          contributionRate: 600_00,
          linkedAccountIds: [],
          isCompleted:      false,
        },
      }),
    ]);
    console.log("  ✓ Goals (5 goals — on track, at risk, in progress, completed)");
  }

  // ── 8. Budget (current month) ─────────────────────────────────────────────
  const now = new Date();
  const hasBudget = await db.budget.findFirst({
    where: { organizationId: org.id, userId: demo.id, month: now.getMonth() + 1, year: now.getFullYear() },
  });

  if (!hasBudget) {
    const budget = await db.budget.create({
      data: {
        organizationId: org.id,
        userId:         demo.id,
        name:           "Monthly Budget",
        month:          now.getMonth() + 1,
        year:           now.getFullYear(),
        rollover:       false,
      },
    });

    await db.budgetCategory.createMany({
      data: [
        { budgetId: budget.id, category: "Food & Dining",     limitAmount:  80_000n, spentAmount:  50_868n },  // 64% — OK
        { budgetId: budget.id, category: "Shopping",          limitAmount: 100_000n, spentAmount: 191_798n },  // 192% — OVER (MacBook!)
        { budgetId: budget.id, category: "Bills & Utilities", limitAmount:  40_000n, spentAmount:  36_200n },  // 91% — near limit
        { budgetId: budget.id, category: "Subscriptions",     limitAmount:  15_000n, spentAmount:   6_347n },  // 42% — OK
        { budgetId: budget.id, category: "Travel & Transport",limitAmount:  30_000n, spentAmount:   8_000n },  // 27% — OK
        { budgetId: budget.id, category: "Health & Wellness", limitAmount:  20_000n, spentAmount:   6_850n },  // 34% — OK
        { budgetId: budget.id, category: "Entertainment",     limitAmount:  20_000n, spentAmount:   0n     },  // 0% — not used yet
        { budgetId: budget.id, category: "Income",            limitAmount:       0n, spentAmount:       0n },  // tracked separately
      ],
    });
    console.log("  ✓ Budget with 8 categories (Shopping over budget due to MacBook — great demo!)");
  }

  // ── 9. Net worth snapshots (6 months of growth) ──────────────────────────
  const snapData = [
    { mAgo: 5, assets: 58_200_00n, liabs: 16_800_00n },  // $41,400
    { mAgo: 4, assets: 60_100_00n, liabs: 16_200_00n },  // $43,900
    { mAgo: 3, assets: 62_800_00n, liabs: 15_900_00n },  // $46,900
    { mAgo: 2, assets: 65_400_00n, liabs: 15_700_00n },  // $49,700
    { mAgo: 1, assets: 67_100_00n, liabs: 15_400_00n },  // $51,700
    { mAgo: 0, assets: 68_527_50n, liabs: 15_448_36n },  // $53,079 — today
  ];

  for (const snap of snapData) {
    const snapDate = monthsAgo(snap.mAgo);
    await db.netWorthSnapshot.upsert({
      where: { organizationId_userId_snapshotDate: { organizationId: org.id, userId: demo.id, snapshotDate: snapDate } },
      update: {},
      create: {
        organizationId:    org.id,
        userId:            demo.id,
        totalAssets:       snap.assets,
        totalLiabilities:  snap.liabs,
        netWorth:          snap.assets - snap.liabs,
        snapshotDate:      snapDate,
        breakdown: {
          checking:    624_75,
          savings:     18_430_00,
          investment:  42_850_00,
          credit_card: 1_248_36,
          loan:        14_200_00,
        },
      },
    });
  }
  console.log("  ✓ Net worth snapshots (6 months — showing upward trend)");

  // ── 10. Credit data ──────────────────────────────────────────────────────
  const hasCreditScores = await db.creditScore.count({ where: { organizationId: org.id, userId: demo.id } });
  if (hasCreditScores === 0) {
    const creditScores = [
      { daysAgo: 150, score: 718 }, { daysAgo: 120, score: 724 },
      { daysAgo:  90, score: 729 }, { daysAgo:  60, score: 733 },
      { daysAgo:  30, score: 738 }, { daysAgo:   0, score: 742 },
    ];
    for (const cs of creditScores) {
      const scoreDate = new Date(); scoreDate.setDate(scoreDate.getDate() - cs.daysAgo); scoreDate.setHours(0,0,0,0);
      await db.creditScore.create({
        data: {
          organizationId: org.id, userId: demo.id, score: cs.score, scoreDate,
          paymentHistory: 99, creditUtilization: 14, creditAge: 82,
          derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7,
        },
      });
    }

    await db.creditAccount.createMany({
      data: [
        { organizationId: org.id, userId: demo.id, accountName: "Amex Gold Card",    accountType: "credit_card", accountNumber: "****3456", creditor: "American Express",            balance: 1_248_36n,  creditLimit: 25_000_00n, accountStatus: "open", paymentStatus: "current", openDate: new Date("2019-03-15"), lastPaymentDate: daysAgo(5),  nextPaymentDue: new Date(Date.now() + 25*86400000) },
        { organizationId: org.id, userId: demo.id, accountName: "Chase Sapphire",    accountType: "credit_card", accountNumber: "****7890", creditor: "Chase Bank",                  balance:     0n,      creditLimit: 15_000_00n, accountStatus: "open", paymentStatus: "current", openDate: new Date("2020-07-22"), lastPaymentDate: daysAgo(3),  nextPaymentDue: new Date(Date.now() + 27*86400000) },
        { organizationId: org.id, userId: demo.id, accountName: "Toyota Auto Loan",  accountType: "auto_loan",   accountNumber: "****5678", creditor: "Toyota Financial Services", balance: 14_200_00n, creditLimit: 28_000_00n, accountStatus: "open", paymentStatus: "current", monthlyPayment: 450_00n, openDate: new Date("2022-01-10"), lastPaymentDate: daysAgo(8), nextPaymentDue: new Date(Date.now() + 22*86400000) },
      ],
    });
    console.log("  ✓ Credit scores (6 months trending 718→742) + credit accounts");
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════╗
║          FinVerse Demo — Ready for Professor!        ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  URL      : http://localhost:3000                    ║
║  Email    : demo@finverse.app                        ║
║  Password : Demo@2024                                ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║  DEMO HIGHLIGHTS                                     ║
║  • 5 accounts  (checking, savings, credit,           ║
║                 Roth IRA, auto loan)                 ║
║  • 60 transactions across 3 months                   ║
║  • 5 goals  (on-track, at-risk, done, in-progress)   ║
║  • Budget: Shopping 192% over due to MacBook buy     ║
║  • Net worth grew $11,679 over 6 months              ║
║  • Credit score: 718 → 742 (improving)               ║
║                                                      ║
║  Viewer-only account: viewer@finverse.app            ║
║  Password: Demo@2024 (same)                          ║
╚══════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
