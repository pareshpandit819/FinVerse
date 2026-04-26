import { PrismaClient } from "@prisma/client";
import { encryptMfaSecret } from "@repo/shared/crypto";
import { generateTotpSecret } from "@repo/shared/totp";

const db = new PrismaClient({ log: ["warn", "error"] });

async function main(): Promise<void> {
  console.log("Seeding development database...");

  // ---------------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------------
  const org = await db.organization.upsert({
    where: { slug: "acme-financial" },
    update: {},
    create: {
      name: "Acme Financial",
      slug: "acme-financial",
    },
  });
  console.log(`  ✓ Organization: ${org.name} (${org.id})`);

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const now = new Date();

  const ownerUser = await db.user.upsert({
    where: { email: "owner@acme.example" },
    update: {},
    create: {
      email: "owner@acme.example",
      name: "Alice Owner",
      emailVerifiedAt: now,
    },
  });

  const adminUser = await db.user.upsert({
    where: { email: "admin@acme.example" },
    update: {},
    create: {
      email: "admin@acme.example",
      name: "Bob Admin",
      emailVerifiedAt: now,
    },
  });

  const memberUser = await db.user.upsert({
    where: { email: "member@acme.example" },
    update: {},
    create: {
      email: "member@acme.example",
      name: "Carol Member",
      emailVerifiedAt: now,
    },
  });

  const viewerUser = await db.user.upsert({
    where: { email: "viewer@acme.example" },
    update: {},
    create: {
      email: "viewer@acme.example",
      name: "Dave Viewer",
      emailVerifiedAt: now,
    },
  });

  console.log("  ✓ Users: owner, admin, member, viewer");

  // ---------------------------------------------------------------------------
  // Memberships
  // ---------------------------------------------------------------------------
  const membershipData = [
    { userId: ownerUser.id, role: "OWNER" as const },
    { userId: adminUser.id, role: "ADMIN" as const },
    { userId: memberUser.id, role: "MEMBER" as const },
    { userId: viewerUser.id, role: "VIEWER" as const },
  ];

  for (const { userId, role } of membershipData) {
    await db.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      update: {},
      create: { organizationId: org.id, userId, role },
    });
  }
  console.log("  ✓ Memberships created");

  // ---------------------------------------------------------------------------
  // Pre-enrolled MFA for owner (demo only)
  // ---------------------------------------------------------------------------
  const existingMfa = await db.mfaSecret.findFirst({ where: { userId: ownerUser.id, verified: true } });
  if (!existingMfa) {
    const { secret } = generateTotpSecret(ownerUser.email);
    await db.mfaSecret.create({
      data: {
        userId: ownerUser.id,
        encryptedSecret: encryptMfaSecret(secret),
        verified: true,
      },
    });
    console.log("  ✓ MFA secret enrolled for owner");
  }

  // ---------------------------------------------------------------------------
  // Financial accounts (manually entered — no Plaid)
  // ---------------------------------------------------------------------------
  let checkingAcct = await db.financialAccount.findFirst({
    where: { organizationId: org.id, name: "Chase Checking" },
  });
  if (!checkingAcct) {
    checkingAcct = await db.financialAccount.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Chase Checking",
        type: "checking",
        balanceCurrent: 485230n,
        isoCurrencyCode: "USD",
      },
    });
  }

  let savingsAcct = await db.financialAccount.findFirst({
    where: { organizationId: org.id, name: "Chase Savings" },
  });
  if (!savingsAcct) {
    savingsAcct = await db.financialAccount.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Chase Savings",
        type: "savings",
        balanceCurrent: 1200000n,
        isoCurrencyCode: "USD",
      },
    });
  }

  let creditAcct = await db.financialAccount.findFirst({
    where: { organizationId: org.id, name: "Amex Gold Card" },
  });
  if (!creditAcct) {
    creditAcct = await db.financialAccount.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Amex Gold Card",
        type: "credit_card",
        balanceCurrent: 41000n,
        isoCurrencyCode: "USD",
      },
    });
  }

  let brokerageAcct = await db.financialAccount.findFirst({
    where: { organizationId: org.id, name: "Fidelity IRA" },
  });
  if (!brokerageAcct) {
    brokerageAcct = await db.financialAccount.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Fidelity IRA",
        type: "investment",
        balanceCurrent: 3250000n,
        isoCurrencyCode: "USD",
      },
    });
  }

  console.log("  ✓ Accounts (checking, savings, credit card, IRA)");

  // ---------------------------------------------------------------------------
  // Transactions (last 30 days)
  // ---------------------------------------------------------------------------
  const existingTxns = await db.transaction.count({ where: { organizationId: org.id } });
  if (existingTxns === 0) {
    const txnData = [
      { name: "Whole Foods Market", amount: 8734n, merchantName: "Whole Foods", category: "Food & Dining", daysAgo: 2 },
      { name: "Netflix", amount: 1549n, merchantName: "Netflix", category: "Entertainment", daysAgo: 5 },
      { name: "Shell Gas Station", amount: 6200n, merchantName: "Shell", category: "Travel & Transport", daysAgo: 7 },
      { name: "Spotify", amount: 999n, merchantName: "Spotify", category: "Subscriptions", daysAgo: 8 },
      { name: "Amazon.com", amount: 4320n, merchantName: "Amazon", category: "Shopping", daysAgo: 10 },
      { name: "Chipotle", amount: 1285n, merchantName: "Chipotle", category: "Food & Dining", daysAgo: 11 },
      { name: "AT&T Bill", amount: 8500n, merchantName: "AT&T", category: "Bills & Utilities", daysAgo: 14 },
      { name: "Trader Joe's", amount: 6150n, merchantName: "Trader Joe's", category: "Food & Dining", daysAgo: 15 },
      { name: "Planet Fitness", amount: 4000n, merchantName: "Planet Fitness", category: "Health & Wellness", daysAgo: 18 },
      { name: "Hulu", amount: 1799n, merchantName: "Hulu", category: "Subscriptions", daysAgo: 20 },
      { name: "Starbucks", amount: 685n, merchantName: "Starbucks", category: "Food & Dining", daysAgo: 22 },
      { name: "Costco", amount: 18430n, merchantName: "Costco", category: "Shopping", daysAgo: 25 },
    ];

    for (const txn of txnData) {
      const date = new Date();
      date.setDate(date.getDate() - txn.daysAgo);
      await db.transaction.create({
        data: {
          financialAccountId: checkingAcct.id,
          organizationId: org.id,
          amount: txn.amount,
          isoCurrencyCode: "USD",
          date,
          name: txn.name,
          merchantName: txn.merchantName,
          customCategory: txn.category,
          pending: false,
        },
      });
    }
    console.log(`  ✓ Transactions (${txnData.length} sample transactions)`);
  }

  // ---------------------------------------------------------------------------
  // Net worth snapshot (today)
  // ---------------------------------------------------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.netWorthSnapshot.upsert({
    where: { organizationId_userId_snapshotDate: { organizationId: org.id, userId: ownerUser.id, snapshotDate: today } },
    update: {},
    create: {
      organizationId: org.id,
      userId: ownerUser.id,
      totalAssets: 4935230n,
      totalLiabilities: 41000n,
      netWorth: 4894230n,
      snapshotDate: today,
      breakdown: {
        checking: 485230,
        savings: 1200000,
        investment: 3250000,
        other: 0,
        credit_card: 41000,
        loans: 0,
      },
    },
  });
  console.log("  ✓ Net worth snapshot");

  // ---------------------------------------------------------------------------
  // Goal
  // ---------------------------------------------------------------------------
  const existingGoal = await db.goal.findFirst({ where: { organizationId: org.id, userId: ownerUser.id } });
  if (!existingGoal) {
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + 2);

    await db.goal.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Emergency Fund (6 months)",
        targetAmount: 2400000n,
        currentAmount: 1200000n,
        targetDate,
        contributionRate: 50000,
        linkedAccountIds: [savingsAcct.id],
      },
    });
  }
  console.log("  ✓ Goal");

  // ---------------------------------------------------------------------------
  // Budget
  // ---------------------------------------------------------------------------
  const currentMonth = new Date();
  const existingBudget = await db.budget.findFirst({
    where: {
      organizationId: org.id,
      userId: ownerUser.id,
      month: currentMonth.getMonth() + 1,
      year: currentMonth.getFullYear(),
    },
  });

  if (!existingBudget) {
    const budget = await db.budget.create({
      data: {
        organizationId: org.id,
        userId: ownerUser.id,
        name: "Monthly Budget",
        month: currentMonth.getMonth() + 1,
        year: currentMonth.getFullYear(),
        rollover: false,
      },
    });

    const categories = [
      { category: "Food & Dining", limitAmount: 80000n, spentAmount: 34854n },
      { category: "Entertainment", limitAmount: 15000n, spentAmount: 3348n },
      { category: "Shopping", limitAmount: 25000n, spentAmount: 22750n },
      { category: "Travel & Transport", limitAmount: 10000n, spentAmount: 6200n },
      { category: "Health & Wellness", limitAmount: 8000n, spentAmount: 4000n },
      { category: "Bills & Utilities", limitAmount: 9000n, spentAmount: 8500n },
      { category: "Subscriptions", limitAmount: 5000n, spentAmount: 2748n },
    ];

    for (const cat of categories) {
      await db.budgetCategory.create({
        data: { budgetId: budget.id, ...cat },
      });
    }
  }
  console.log("  ✓ Budget with categories");

  console.log("\nSeed complete.");
  console.log("\nDev login credentials:");
  console.log("  owner@acme.example  — OWNER");
  console.log("  admin@acme.example  — ADMIN");
  console.log("  member@acme.example — MEMBER");
  console.log("  viewer@acme.example — VIEWER");
  console.log("\nSign in at http://localhost:3000/login with any of the above emails.");
  console.log("Use the register page to set a password, or update the password column directly in the DB for seeded users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
