import { PrismaClient } from "@prisma/client";
import { encryptToken, encryptMfaSecret } from "@repo/shared/crypto";
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
  // Pre-enrolled MFA for owner (demo only — seed generates a TOTP secret)
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
    console.log("  ✓ MFA secret enrolled for owner (check seed output for TOTP secret)");
  }

  // ---------------------------------------------------------------------------
  // Plaid items (fake sandbox tokens — never real credentials)
  // ---------------------------------------------------------------------------
  const fakeEncryptedToken = encryptToken("access-sandbox-fake-token-checking-00000000");
  const fakeEncryptedToken2 = encryptToken("access-sandbox-fake-token-invest-00000000");

  const plaidItem1 = await db.plaidItem.upsert({
    where: { itemId: "item-sandbox-checking-001" },
    update: {},
    create: {
      organizationId: org.id,
      userId: ownerUser.id,
      encryptedAccessToken: fakeEncryptedToken,
      itemId: "item-sandbox-checking-001",
      institutionId: "ins_109508",
      institutionName: "First Platypus Bank",
      status: "active",
      lastSyncedAt: now,
    },
  });

  const plaidItem2 = await db.plaidItem.upsert({
    where: { itemId: "item-sandbox-invest-001" },
    update: {},
    create: {
      organizationId: org.id,
      userId: ownerUser.id,
      encryptedAccessToken: fakeEncryptedToken2,
      itemId: "item-sandbox-invest-001",
      institutionId: "ins_115616",
      institutionName: "Tartan Bank",
      status: "active",
      lastSyncedAt: now,
    },
  });

  console.log("  ✓ Plaid items (sandbox)");

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  const checkingAcct = await db.plaidAccount.upsert({
    where: { accountId: "acct-sandbox-checking-001" },
    update: { balanceCurrent: 485230n },
    create: {
      plaidItemId: plaidItem1.id,
      organizationId: org.id,
      accountId: "acct-sandbox-checking-001",
      name: "Plaid Checking",
      officialName: "Plaid Gold Standard 0% Interest Checking",
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balanceCurrent: 485230n,
      balanceAvailable: 483230n,
      isoCurrencyCode: "USD",
    },
  });

  const savingsAcct = await db.plaidAccount.upsert({
    where: { accountId: "acct-sandbox-savings-001" },
    update: { balanceCurrent: 1200000n },
    create: {
      plaidItemId: plaidItem1.id,
      organizationId: org.id,
      accountId: "acct-sandbox-savings-001",
      name: "Plaid Saving",
      officialName: "Plaid Silver Standard 0.1% Interest Saving",
      type: "depository",
      subtype: "savings",
      mask: "1111",
      balanceCurrent: 1200000n,
      balanceAvailable: 1200000n,
      isoCurrencyCode: "USD",
    },
  });

  const creditAcct = await db.plaidAccount.upsert({
    where: { accountId: "acct-sandbox-credit-001" },
    update: { balanceCurrent: 41000n },
    create: {
      plaidItemId: plaidItem1.id,
      organizationId: org.id,
      accountId: "acct-sandbox-credit-001",
      name: "Plaid Credit Card",
      type: "credit",
      subtype: "credit card",
      mask: "3333",
      balanceCurrent: 41000n,
      balanceLimit: 1000000n,
      isoCurrencyCode: "USD",
    },
  });

  const brokerageAcct = await db.plaidAccount.upsert({
    where: { accountId: "acct-sandbox-brokerage-001" },
    update: { balanceCurrent: 3250000n },
    create: {
      plaidItemId: plaidItem2.id,
      organizationId: org.id,
      accountId: "acct-sandbox-brokerage-001",
      name: "Plaid IRA",
      type: "investment",
      subtype: "ira",
      mask: "6666",
      balanceCurrent: 3250000n,
      isoCurrencyCode: "USD",
    },
  });

  console.log("  ✓ Accounts (checking, savings, credit, brokerage)");

  // ---------------------------------------------------------------------------
  // Transactions (last 30 days)
  // ---------------------------------------------------------------------------
  const txnData = [
    { name: "Whole Foods Market", amount: 8734n, merchantName: "Whole Foods", category: "Groceries", daysAgo: 2 },
    { name: "Netflix", amount: 1549n, merchantName: "Netflix", category: "Entertainment", daysAgo: 5 },
    { name: "Shell", amount: 6200n, merchantName: "Shell", category: "Gas Stations", daysAgo: 7 },
    { name: "Spotify", amount: 999n, merchantName: "Spotify", category: "Entertainment", daysAgo: 8 },
    { name: "Amazon.com", amount: 4320n, merchantName: "Amazon", category: "Shopping", daysAgo: 10 },
    { name: "Chipotle", amount: 1285n, merchantName: "Chipotle", category: "Restaurants", daysAgo: 11 },
    { name: "AT&T", amount: 8500n, merchantName: "AT&T", category: "Phone", daysAgo: 14 },
    { name: "Trader Joe's", amount: 6150n, merchantName: "Trader Joe's", category: "Groceries", daysAgo: 15 },
    { name: "Gym Membership", amount: 4000n, merchantName: "Planet Fitness", category: "Health", daysAgo: 18 },
    { name: "Hulu", amount: 1799n, merchantName: "Hulu", category: "Entertainment", daysAgo: 20 },
    { name: "Starbucks", amount: 685n, merchantName: "Starbucks", category: "Coffee", daysAgo: 22 },
    { name: "Costco", amount: 18430n, merchantName: "Costco", category: "Groceries", daysAgo: 25 },
  ];

  for (const [i, txn] of txnData.entries()) {
    const date = new Date();
    date.setDate(date.getDate() - txn.daysAgo);
    const txnId = `txn-sandbox-${String(i).padStart(3, "0")}`;

    await db.transaction.upsert({
      where: { transactionId: txnId },
      update: {},
      create: {
        plaidAccountId: checkingAcct.id,
        organizationId: org.id,
        transactionId: txnId,
        amount: txn.amount,
        isoCurrencyCode: "USD",
        date,
        name: txn.name,
        merchantName: txn.merchantName,
        paymentChannel: "in store",
        plaidCategories: [txn.category],
        pending: false,
      },
    });
  }
  console.log(`  ✓ Transactions (${txnData.length} sample transactions)`);

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
        credit: 41000,
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
      { category: "Groceries", limitAmount: 60000n, spentAmount: 33314n },
      { category: "Entertainment", limitAmount: 15000n, spentAmount: 4347n },
      { category: "Restaurants", limitAmount: 20000n, spentAmount: 1285n },
      { category: "Gas Stations", limitAmount: 10000n, spentAmount: 6200n },
      { category: "Shopping", limitAmount: 25000n, spentAmount: 4320n },
      { category: "Health", limitAmount: 8000n, spentAmount: 4000n },
      { category: "Phone", limitAmount: 9000n, spentAmount: 8500n },
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
  console.log("\nSend a magic link to any of the above via Mailhog (http://localhost:8025)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
