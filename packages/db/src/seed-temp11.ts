import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ log: ["warn", "error"] });

const USER_ID  = "26a4f9cc-e425-4429-b87c-b11b11ae71bb";
const ORG_ID   = "567ce5cb-0d10-44df-9ee1-b84beee5df12";

// Clean up duplicate accounts first, then rename
const CHECKING_ID   = "3f77df6c-e096-43c4-b0f7-463f35ce0986";
const SAVINGS_ID    = "48a99240-624e-42a8-8c78-a2530b43b081";
// Remove the two duplicate Chase Checking accounts
const DUP1 = "e1dbec54-514c-42e4-a8f5-d74a49e4af41";
const DUP2 = "c4d1884a-78bd-42c2-bc07-c805f6565fea";

async function main() {
  console.log("Seeding temp11@gmail.com demo data…");

  // ── Password ──────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("Password123!", 12);
  await db.user.update({ where: { id: USER_ID }, data: { password: hash } });
  console.log("  ✓ Password set");

  // ── Remove duplicate accounts ─────────────────────────────────────────────
  await db.financialAccount.deleteMany({ where: { id: { in: [DUP1, DUP2] } } });
  console.log("  ✓ Removed duplicate accounts");

  // ── Rename & update existing accounts ─────────────────────────────────────
  await db.financialAccount.update({
    where: { id: CHECKING_ID },
    data: { name: "Chase Checking", balanceCurrent: 548273n },
  });
  await db.financialAccount.update({
    where: { id: SAVINGS_ID },
    data: { name: "Marcus Savings", balanceCurrent: 1850000n },
  });

  // ── Add new accounts ───────────────────────────────────────────────────────
  const [creditCard, ira] = await Promise.all([
    db.financialAccount.upsert({
      where: { id: "aaaaaaaa-0001-4000-8000-000000000001" },
      create: {
        id: "aaaaaaaa-0001-4000-8000-000000000001",
        organizationId: ORG_ID, userId: USER_ID,
        name: "Chase Sapphire Reserve",
        type: "credit_card",
        balanceCurrent: 234750n,
        isoCurrencyCode: "USD",
      },
      update: {},
    }),
    db.financialAccount.upsert({
      where: { id: "aaaaaaaa-0002-4000-8000-000000000002" },
      create: {
        id: "aaaaaaaa-0002-4000-8000-000000000002",
        organizationId: ORG_ID, userId: USER_ID,
        name: "Vanguard Roth IRA",
        type: "investment",
        balanceCurrent: 4275000n,
        isoCurrencyCode: "USD",
      },
      update: {},
    }),
  ]);
  console.log("  ✓ Accounts ready (4 total)");

  // ── Transactions (last 45 days) ────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  const txns = [
    // Checking — income & bills
    { accountId: CHECKING_ID, amount: -285000n, name: "Direct Deposit — Salary",   category: "Income",           date: daysAgo(2) },
    { accountId: CHECKING_ID, amount:   89900n, name: "Rent — Apt 4B",             category: "Bills & Utilities", date: daysAgo(3) },
    { accountId: CHECKING_ID, amount:    9500n, name: "AT&T Phone Bill",            category: "Bills & Utilities", date: daysAgo(8) },
    { accountId: CHECKING_ID, amount:    7200n, name: "Con Edison Electric",        category: "Bills & Utilities", date: daysAgo(10) },
    { accountId: CHECKING_ID, amount:   15000n, name: "Transfer to Savings",        category: "Transfer",          date: daysAgo(5) },
    { accountId: CHECKING_ID, amount: -285000n, name: "Direct Deposit — Salary",   category: "Income",           date: daysAgo(32) },
    { accountId: CHECKING_ID, amount:   89900n, name: "Rent — Apt 4B",             category: "Bills & Utilities", date: daysAgo(33) },
    // Credit card — daily spending
    { accountId: creditCard.id, amount:  5423n, name: "Whole Foods Market",         category: "Groceries",         date: daysAgo(1) },
    { accountId: creditCard.id, amount:  1549n, name: "Starbucks",                  category: "Dining Out",        date: daysAgo(1) },
    { accountId: creditCard.id, amount:  8742n, name: "Sweetgreen",                 category: "Dining Out",        date: daysAgo(3) },
    { accountId: creditCard.id, amount:  1599n, name: "Netflix",                    category: "Subscriptions",     date: daysAgo(5) },
    { accountId: creditCard.id, amount:  1499n, name: "Spotify",                    category: "Subscriptions",     date: daysAgo(5) },
    { accountId: creditCard.id, amount: 15800n, name: "Citi Field Tickets",         category: "Entertainment",     date: daysAgo(7) },
    { accountId: creditCard.id, amount:  6234n, name: "Trader Joe's",               category: "Groceries",         date: daysAgo(8) },
    { accountId: creditCard.id, amount: 12500n, name: "United Airlines",             category: "Travel",            date: daysAgo(9) },
    { accountId: creditCard.id, amount:  4200n, name: "CVS Pharmacy",               category: "Health & Wellness", date: daysAgo(11) },
    { accountId: creditCard.id, amount: 24999n, name: "Apple Store",                category: "Shopping",          date: daysAgo(12) },
    { accountId: creditCard.id, amount:  7850n, name: "Equinox Gym",                category: "Health & Wellness", date: daysAgo(14) },
    { accountId: creditCard.id, amount:  3199n, name: "Amazon Prime",               category: "Subscriptions",     date: daysAgo(15) },
    { accountId: creditCard.id, amount:  9420n, name: "Shake Shack",                category: "Dining Out",        date: daysAgo(16) },
    { accountId: creditCard.id, amount:  5612n, name: "Whole Foods Market",         category: "Groceries",         date: daysAgo(18) },
    { accountId: creditCard.id, amount: 18700n, name: "Delta Airlines",             category: "Travel",            date: daysAgo(20) },
    { accountId: creditCard.id, amount:  2799n, name: "Hulu",                       category: "Subscriptions",     date: daysAgo(20) },
    { accountId: creditCard.id, amount:  6780n, name: "Chipotle",                   category: "Dining Out",        date: daysAgo(22) },
    { accountId: creditCard.id, amount: 34900n, name: "Best Buy — Monitor",         category: "Shopping",          date: daysAgo(24) },
    { accountId: creditCard.id, amount:  4899n, name: "Target",                     category: "Shopping",          date: daysAgo(26) },
    { accountId: creditCard.id, amount:  7100n, name: "Whole Foods Market",         category: "Groceries",         date: daysAgo(28) },
    { accountId: creditCard.id, amount: 12300n, name: "Soul Cycle",                 category: "Health & Wellness", date: daysAgo(30) },
    { accountId: creditCard.id, amount: 55000n, name: "Airbnb — Weekend Trip",      category: "Travel",            date: daysAgo(35) },
    { accountId: creditCard.id, amount:  8950n, name: "Nobu Restaurant",            category: "Dining Out",        date: daysAgo(38) },
  ];

  for (const tx of txns) {
    await db.transaction.create({
      data: {
        organizationId: ORG_ID,
        financialAccountId: tx.accountId,
        amount: tx.amount,
        name: tx.name,
        customCategory: tx.category,
        date: tx.date,
        pending: false,
        isoCurrencyCode: "USD",
      },
    });
  }
  console.log(`  ✓ ${txns.length} transactions created`);

  // ── Net Worth Snapshot ─────────────────────────────────────────────────────
  const totalAssets = 548273n + 1850000n + 4275000n;
  const totalLiabs  = 234750n;
  const snapshots = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    const growth = BigInt(Math.floor(i * 35000));
    const assets = totalAssets - growth + BigInt(Math.floor(Math.random() * 20000));
    const liabs = totalLiabs + BigInt(Math.floor(Math.random() * 15000));
    return { date: d, totalAssets: assets, totalLiabilities: liabs, netWorth: assets - liabs };
  });

  for (const s of snapshots) {
    await db.netWorthSnapshot.upsert({
      where: {
        organizationId_userId_snapshotDate: {
          organizationId: ORG_ID,
          userId: USER_ID,
          snapshotDate: s.date,
        },
      },
      create: {
        organizationId: ORG_ID,
        userId: USER_ID,
        snapshotDate: s.date,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        netWorth: s.netWorth,
        breakdown: { checking: 548273, savings: 1850000, investment: 4275000, credit_card: -234750 },
      },
      update: {},
    });
  }
  console.log("  ✓ 12 net worth snapshots");

  // ── Goals ──────────────────────────────────────────────────────────────────
  const goals = [
    { id: "bbbbbbbb-0001-4000-8000-000000000001", name: "Emergency Fund", targetAmount: 2400000n, currentAmount: 1850000n, targetDate: new Date("2026-12-31"), contributionRate: 50000 },
    { id: "bbbbbbbb-0002-4000-8000-000000000002", name: "Europe Vacation", targetAmount: 500000n,  currentAmount: 85000n,  targetDate: new Date("2026-08-01"), contributionRate: 30000 },
    { id: "bbbbbbbb-0003-4000-8000-000000000003", name: "New MacBook Pro",  targetAmount: 350000n,  currentAmount: 350000n, targetDate: new Date("2027-06-01"), contributionRate: 0, isCompleted: true },
  ];

  for (const g of goals) {
    await db.goal.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        organizationId: ORG_ID,
        userId: USER_ID,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        contributionRate: g.contributionRate,
        isCompleted: g.isCompleted ?? false,
      },
      update: {},
    });
  }
  console.log("  ✓ 3 goals (2 active, 1 completed)");

  // ── Budget ─────────────────────────────────────────────────────────────────
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const budget = await db.budget.upsert({
    where: {
      organizationId_userId_month_year: {
        organizationId: ORG_ID, userId: USER_ID, month, year,
      },
    },
    create: { organizationId: ORG_ID, userId: USER_ID, name: "Monthly Budget", month, year, rollover: false },
    update: {},
  });

  const categories = [
    { category: "Groceries",        limitAmount: 60000n, spentAmount: 17269n },
    { category: "Dining Out",       limitAmount: 50000n, spentAmount: 32911n },
    { category: "Subscriptions",    limitAmount: 15000n, spentAmount: 10846n },
    { category: "Entertainment",    limitAmount: 20000n, spentAmount: 15800n },
    { category: "Travel",           limitAmount: 100000n, spentAmount: 87500n },
    { category: "Health & Wellness",limitAmount: 25000n, spentAmount: 24200n },
    { category: "Shopping",         limitAmount: 60000n, spentAmount: 64899n },
    { category: "Bills & Utilities",limitAmount: 110000n, spentAmount: 106600n },
  ];

  for (const cat of categories) {
    const existing = await db.budgetCategory.findFirst({
      where: { budgetId: budget.id, category: cat.category },
    });
    if (!existing) {
      await db.budgetCategory.create({ data: { budgetId: budget.id, ...cat } });
    }
  }
  console.log("  ✓ Budget with 8 categories");

  // ── Credit Scores ──────────────────────────────────────────────────────────
  // Clear existing credit scores for idempotency
  await db.creditScore.deleteMany({ where: { organizationId: ORG_ID, userId: USER_ID } });
  const scoreBase = [688, 692, 695, 700, 704, 708, 712, 715, 718, 720, 724, 728];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    await db.creditScore.create({
      data: {
        organizationId: ORG_ID,
        userId: USER_ID,
        score: scoreBase[i]!,
        paymentHistory: 94 + Math.floor(i * 0.3),
        creditUtilization: 38 - i,
        creditAge: 72 + i,
        derogatoryMarks: i < 3 ? 1 : 0,
        hardInquiries: i === 0 ? 2 : i === 1 ? 1 : 0,
        totalAccounts: 5,
        scoreDate: d,
      },
    });
  }
  console.log("  ✓ 12 credit score snapshots");

  // ── Credit Accounts ────────────────────────────────────────────────────────
  const creditAccounts = [
    {
      id: "cccccccc-0001-4000-8000-000000000001",
      accountType: "credit_card",
      accountName: "Chase Sapphire Reserve",
      accountNumber: "****4521",
      creditor: "Chase Bank",
      balance: 234750n, creditLimit: 1500000n,
      monthlyPayment: 25000n,
      nextPaymentDue: new Date("2026-05-15"),
      openDate: new Date("2022-03-10"),
      paymentStatus: "current",
    },
    {
      id: "cccccccc-0002-4000-8000-000000000002",
      accountType: "auto_loan",
      accountName: "Toyota Financial — Camry",
      accountNumber: "****8832",
      creditor: "Toyota Financial Services",
      balance: 1842000n, creditLimit: null,
      monthlyPayment: 42800n,
      nextPaymentDue: new Date("2026-05-01"),
      openDate: new Date("2023-08-15"),
      paymentStatus: "current",
    },
    {
      id: "cccccccc-0003-4000-8000-000000000003",
      accountType: "student_loan",
      accountName: "Navient Student Loan",
      accountNumber: "****2290",
      creditor: "Navient",
      balance: 2250000n, creditLimit: null,
      monthlyPayment: 30000n,
      nextPaymentDue: new Date("2026-05-10"),
      openDate: new Date("2018-09-01"),
      paymentStatus: "current",
    },
  ];

  for (const ca of creditAccounts) {
    await db.creditAccount.upsert({
      where: { id: ca.id },
      create: {
        id: ca.id,
        organizationId: ORG_ID, userId: USER_ID,
        accountType: ca.accountType,
        accountName: ca.accountName,
        accountNumber: ca.accountNumber,
        creditor: ca.creditor,
        balance: ca.balance,
        creditLimit: ca.creditLimit,
        monthlyPayment: ca.monthlyPayment,
        nextPaymentDue: ca.nextPaymentDue,
        openDate: ca.openDate,
        paymentStatus: ca.paymentStatus,
      },
      update: {},
    });
  }
  console.log("  ✓ 3 credit accounts");

  // ── Credit History ─────────────────────────────────────────────────────────
  await db.creditHistory.deleteMany({ where: { organizationId: ORG_ID, userId: USER_ID } });
  const creditHistory = [
    { eventType: "payment",        description: "On-time payment — Chase Sapphire Reserve",  daysAgo: 2,   acctIdx: 0 },
    { eventType: "payment",        description: "On-time payment — Toyota Camry Auto Loan",   daysAgo: 5,   acctIdx: 1 },
    { eventType: "payment",        description: "On-time payment — Navient Student Loan",      daysAgo: 10,  acctIdx: 2 },
    { eventType: "payment",        description: "On-time payment — Chase Sapphire Reserve",  daysAgo: 32,  acctIdx: 0 },
    { eventType: "account_open",   description: "Opened Chase Sapphire Reserve",              daysAgo: 365, acctIdx: 0 },
    { eventType: "limit_increase", description: "Credit limit increased — Chase Sapphire",    daysAgo: 180, acctIdx: 0 },
  ];

  for (const ch of creditHistory) {
    const acct = creditAccounts[ch.acctIdx]!;
    await db.creditHistory.create({
      data: {
        organizationId: ORG_ID, userId: USER_ID,
        creditAccountId: acct.id,
        eventType: ch.eventType,
        eventDate: daysAgo(ch.daysAgo),
        eventDescription: ch.description,
      },
    });
  }
  console.log("  ✓ 6 credit history events");

  console.log("\nDone! temp11@gmail.com is fully seeded.");
  console.log("Login: temp11@gmail.com / Password123!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
