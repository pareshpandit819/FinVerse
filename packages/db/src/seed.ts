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

  // ---------------------------------------------------------------------------
  // Credit Score & History
  // ---------------------------------------------------------------------------
  const existingCreditScores = await db.creditScore.count({ where: { organizationId: org.id, userId: ownerUser.id } });
  if (existingCreditScores === 0) {
    // Create credit scores for the last 12 months
    const creditScoreData = [
      { score: 710, paymentHistory: 95, creditUtilization: 30, creditAge: 85, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 6, daysAgo: 365 },
      { score: 715, paymentHistory: 95, creditUtilization: 32, creditAge: 84, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 6, daysAgo: 330 },
      { score: 720, paymentHistory: 96, creditUtilization: 28, creditAge: 84, derogatoryMarks: 0, hardInquiries: 1, totalAccounts: 6, daysAgo: 300 },
      { score: 725, paymentHistory: 97, creditUtilization: 25, creditAge: 83, derogatoryMarks: 0, hardInquiries: 1, totalAccounts: 6, daysAgo: 270 },
      { score: 728, paymentHistory: 97, creditUtilization: 24, creditAge: 83, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 240 },
      { score: 730, paymentHistory: 98, creditUtilization: 22, creditAge: 82, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 210 },
      { score: 732, paymentHistory: 98, creditUtilization: 20, creditAge: 82, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 180 },
      { score: 735, paymentHistory: 99, creditUtilization: 18, creditAge: 81, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 150 },
      { score: 738, paymentHistory: 99, creditUtilization: 16, creditAge: 81, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 120 },
      { score: 740, paymentHistory: 99, creditUtilization: 15, creditAge: 80, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 90 },
      { score: 742, paymentHistory: 99, creditUtilization: 14, creditAge: 80, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 60 },
      { score: 745, paymentHistory: 100, creditUtilization: 13, creditAge: 79, derogatoryMarks: 0, hardInquiries: 0, totalAccounts: 7, daysAgo: 30 },
    ];

    for (const data of creditScoreData) {
      const scoreDate = new Date();
      scoreDate.setDate(scoreDate.getDate() - data.daysAgo);
      scoreDate.setHours(0, 0, 0, 0);

      await db.creditScore.create({
        data: {
          organizationId: org.id,
          userId: ownerUser.id,
          score: data.score,
          scoreDate,
          paymentHistory: data.paymentHistory,
          creditUtilization: data.creditUtilization,
          creditAge: data.creditAge,
          derogatoryMarks: data.derogatoryMarks,
          hardInquiries: data.hardInquiries,
          totalAccounts: data.totalAccounts,
        },
      });
    }

    console.log("  ✓ Credit scores (12 monthly snapshots)");
  }

  // ---------------------------------------------------------------------------
  // Credit Accounts
  // ---------------------------------------------------------------------------
  const existingCreditAccounts = await db.creditAccount.count({ where: { organizationId: org.id, userId: ownerUser.id } });
  if (existingCreditAccounts === 0) {
    const creditAccountsData = [
      {
        accountName: "Amex Gold Card",
        accountType: "credit_card",
        accountNumber: "****3456",
        creditor: "American Express",
        balance: 41000n,
        creditLimit: 150000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: null,
        openDate: new Date("2018-05-15"),
        lastPaymentDate: new Date(new Date().setDate(new Date().getDate() - 5)),
        nextPaymentDue: new Date(new Date().setDate(new Date().getDate() + 25)),
      },
      {
        accountName: "Chase Sapphire",
        accountType: "credit_card",
        accountNumber: "****7890",
        creditor: "Chase Bank",
        balance: 15200n,
        creditLimit: 100000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: null,
        openDate: new Date("2019-08-22"),
        lastPaymentDate: new Date(new Date().setDate(new Date().getDate() - 3)),
        nextPaymentDue: new Date(new Date().setDate(new Date().getDate() + 27)),
      },
      {
        accountName: "Home Mortgage",
        accountType: "mortgage",
        accountNumber: "****1234",
        creditor: "Wells Fargo",
        balance: 285000000n,
        creditLimit: 450000000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: 220000n,
        openDate: new Date("2015-03-10"),
        lastPaymentDate: new Date(new Date().setDate(new Date().getDate() - 10)),
        nextPaymentDue: new Date(new Date().setDate(new Date().getDate() + 20)),
      },
      {
        accountName: "Auto Loan - Tesla",
        accountType: "auto_loan",
        accountNumber: "****5678",
        creditor: "Tesla Financial",
        balance: 4200000n,
        creditLimit: 5500000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: 125000n,
        openDate: new Date("2021-06-15"),
        lastPaymentDate: new Date(new Date().setDate(new Date().getDate() - 8)),
        nextPaymentDue: new Date(new Date().setDate(new Date().getDate() + 22)),
      },
      {
        accountName: "Student Loan - Federal",
        accountType: "student_loan",
        accountNumber: "****9012",
        creditor: "US Department of Education",
        balance: 28000000n,
        creditLimit: 35000000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: 35000n,
        openDate: new Date("2014-09-01"),
        lastPaymentDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        nextPaymentDue: new Date(new Date().setDate(new Date().getDate() + 28)),
      },
      {
        accountName: "Line of Credit",
        accountType: "line_of_credit",
        accountNumber: "****3344",
        creditor: "Bank of America",
        balance: 0n,
        creditLimit: 50000000n,
        accountStatus: "open",
        paymentStatus: "current",
        monthlyPayment: null,
        openDate: new Date("2016-11-20"),
        lastPaymentDate: null,
        nextPaymentDue: null,
      },
    ];

    for (const acct of creditAccountsData) {
      await db.creditAccount.create({
        data: {
          organizationId: org.id,
          userId: ownerUser.id,
          ...acct,
        },
      });
    }

    console.log("  ✓ Credit accounts (6 credit accounts and loans)");
  }

  // ---------------------------------------------------------------------------
  // Credit History Events
  // ---------------------------------------------------------------------------
  const existingCreditHistory = await db.creditHistory.count({ where: { organizationId: org.id, userId: ownerUser.id } });
  if (existingCreditHistory === 0) {
    const creditAccounts = await db.creditAccount.findMany({
      where: { organizationId: org.id, userId: ownerUser.id },
    });

    const amexAccount = creditAccounts.find((a) => a.accountName === "Amex Gold Card");
    const mortgageAccount = creditAccounts.find((a) => a.accountName === "Home Mortgage");
    const autoAccount = creditAccounts.find((a) => a.accountName === "Auto Loan - Tesla");

    const historyEvents = [
      {
        creditAccountId: amexAccount?.id || "",
        eventType: "payment_received",
        eventDescription: "Payment of $41,000 received",
        daysAgo: 5,
      },
      {
        creditAccountId: amexAccount?.id || "",
        eventType: "account_opened",
        eventDescription: "New Amex Gold Card account opened",
        daysAgo: 2000,
      },
      {
        creditAccountId: mortgageAccount?.id || "",
        eventType: "payment_received",
        eventDescription: "Mortgage payment of $220,000 received",
        daysAgo: 10,
      },
      {
        creditAccountId: mortgageAccount?.id || "",
        eventType: "credit_limit_increase",
        eventDescription: "Credit limit increased from $400,000 to $450,000",
        daysAgo: 180,
      },
      {
        creditAccountId: autoAccount?.id || "",
        eventType: "payment_received",
        eventDescription: "Auto loan payment of $125,000 received",
        daysAgo: 8,
      },
      {
        creditAccountId: autoAccount?.id || "",
        eventType: "account_opened",
        eventDescription: "New auto loan account opened for Tesla purchase",
        daysAgo: 1200,
      },
    ];

    for (const event of historyEvents) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() - event.daysAgo);
      eventDate.setHours(0, 0, 0, 0);

      await db.creditHistory.create({
        data: {
          organizationId: org.id,
          userId: ownerUser.id,
          creditAccountId: event.creditAccountId,
          eventType: event.eventType,
          eventDate,
          eventDescription: event.eventDescription,
        },
      });
    }

    console.log("  ✓ Credit history events (6 sample events)");
  }

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
