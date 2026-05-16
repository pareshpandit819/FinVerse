import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachRequestBody = {
  organizationId?: string;
  messages?: CoachMessage[];
};

type TransactionForCoach = {
  amount: bigint;
  isoCurrencyCode: string;
  date: Date;
  name: string;
  merchantName: string | null;
  customCategory: string | null;
  pending: boolean;
};

type CategorySummary = {
  category: string;
  amountCents: number;
};

type MerchantSummary = {
  merchant: string;
  amountCents: number;
  count: number;
};

function centsToDollars(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function getLastUserMessage(messages: CoachMessage[]): string {
  return (
    messages
      .filter((message) => message.role === "user")
      .at(-1)
      ?.content.toLowerCase() ?? ""
  );
}

function summarizeByCategory(
  transactions: TransactionForCoach[]
): CategorySummary[] {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);

    // In this app, positive amounts are expenses and negative amounts are income.
    if (amount <= 0) continue;

    const category = transaction.customCategory ?? "Uncategorized";
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function summarizeByMerchant(
  transactions: TransactionForCoach[]
): MerchantSummary[] {
  const totals = new Map<string, { amountCents: number; count: number }>();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);

    if (amount <= 0) continue;

    const merchant = transaction.merchantName ?? transaction.name;
    const current = totals.get(merchant) ?? { amountCents: 0, count: 0 };

    totals.set(merchant, {
      amountCents: current.amountCents + amount,
      count: current.count + 1,
    });
  }

  return Array.from(totals.entries())
    .map(([merchant, value]) => ({
      merchant,
      amountCents: value.amountCents,
      count: value.count,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function findSubscriptions(transactions: TransactionForCoach[]) {
  const subscriptionKeywords = [
    "netflix",
    "spotify",
    "hulu",
    "anthropic",
    "claude",
    "gym",
    "fitness",
    "subscription",
  ];

  return transactions
    .filter((transaction) => {
      const text = `${transaction.name} ${transaction.merchantName ?? ""} ${
        transaction.customCategory ?? ""
      }`.toLowerCase();

      return (
        transaction.customCategory === "Subscriptions" ||
        subscriptionKeywords.some((keyword) => text.includes(keyword))
      );
    })
    .map((transaction) => ({
      name: transaction.name,
      merchant: transaction.merchantName ?? transaction.name,
      amountCents: Number(transaction.amount),
      date: transaction.date.toISOString().slice(0, 10),
    }))
    .slice(0, 10);
}

function findLargeTransactions(transactions: TransactionForCoach[]) {
  return transactions
    .filter((transaction) => Number(transaction.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8)
    .map((transaction) => ({
      name: transaction.name,
      merchant: transaction.merchantName ?? transaction.name,
      category: transaction.customCategory ?? "Uncategorized",
      amountCents: Number(transaction.amount),
      date: transaction.date.toISOString().slice(0, 10),
    }));
}

function buildCoachReply(params: {
  userMessage: string;
  transactionCount: number;
  totalSpendingCents: number;
  totalIncomeCents: number;
  pendingCount: number;
  topCategories: CategorySummary[];
  topMerchants: MerchantSummary[];
  subscriptions: ReturnType<typeof findSubscriptions>;
  largeTransactions: ReturnType<typeof findLargeTransactions>;
}): string {
  const {
    userMessage,
    transactionCount,
    totalSpendingCents,
    totalIncomeCents,
    pendingCount,
    topCategories,
    topMerchants,
    subscriptions,
    largeTransactions,
  } = params;

  const netCashFlowCents = totalIncomeCents - totalSpendingCents;
  const topCategory = topCategories[0];
  const topMerchant = topMerchants[0];

  if (transactionCount === 0) {
    return "I do not see enough transaction data yet. Once transactions are available, I can help summarize spending, income, subscriptions, and unusual charges.";
  }

  if (
    userMessage.includes("subscription") ||
    userMessage.includes("recurring")
  ) {
    if (subscriptions.length === 0) {
      return "I do not see clear subscription-like transactions in the recent data. Try checking merchants that repeat monthly or are categorized as Subscriptions.";
    }

    return [
      "Here are subscription-like transactions I found:",
      "",
      ...subscriptions.map(
        (item) =>
          `• ${item.merchant}: ${centsToDollars(item.amountCents)} on ${
            item.date
          }`
      ),
      "",
      "A good next step is to review whether each one is still useful, especially if the same merchant appears every month.",
    ].join("\n");
  }

  if (
    userMessage.includes("unusual") ||
    userMessage.includes("large") ||
    userMessage.includes("biggest")
  ) {
    return [
      "Here are the largest recent transactions I found:",
      "",
      ...largeTransactions.map(
        (item) =>
          `• ${item.merchant}: ${centsToDollars(item.amountCents)} in ${
            item.category
          } on ${item.date}`
      ),
      "",
      "These are worth reviewing first because large transactions usually explain most short-term spending changes.",
    ].join("\n");
  }

  if (
    userMessage.includes("where") ||
    userMessage.includes("spending") ||
    userMessage.includes("spend")
  ) {
    return [
      `You spent about ${centsToDollars(
        totalSpendingCents
      )} in the recent transaction window.`,
      "",
      "Top spending categories:",
      ...topCategories
        .slice(0, 5)
        .map(
          (item) =>
            `• ${item.category}: ${centsToDollars(item.amountCents)}`
        ),
      "",
      topMerchant
        ? `Your top merchant by spend is ${topMerchant.merchant}, at about ${centsToDollars(
            topMerchant.amountCents
          )}.`
        : "I do not see enough merchant data yet.",
    ].join("\n");
  }

  if (
    userMessage.includes("income") ||
    userMessage.includes("cash flow") ||
    userMessage.includes("doing")
  ) {
    return [
      "Here is your recent cash-flow picture:",
      "",
      `• Income: ${centsToDollars(totalIncomeCents)}`,
      `• Spending: ${centsToDollars(totalSpendingCents)}`,
      `• Net cash flow: ${
        netCashFlowCents >= 0 ? "+" : "-"
      }${centsToDollars(netCashFlowCents)}`,
      "",
      netCashFlowCents >= 0
        ? "You are currently positive in this recent window, which is a good sign. The next step is to check whether that surplus is going toward savings, debt, or goals."
        : "You are currently negative in this recent window. I would first review the top spending categories and large transactions to see what caused the gap.",
    ].join("\n");
  }

  return [
    "Here is a quick financial read based on your recent transactions:",
    "",
    `• Transactions reviewed: ${transactionCount}`,
    `• Spending: ${centsToDollars(totalSpendingCents)}`,
    `• Income: ${centsToDollars(totalIncomeCents)}`,
    `• Net cash flow: ${
      netCashFlowCents >= 0 ? "+" : "-"
    }${centsToDollars(netCashFlowCents)}`,
    pendingCount > 0
      ? `• Pending transactions: ${pendingCount}`
      : "• Pending transactions: 0",
    "",
    topCategory
      ? `Your highest spending category is ${topCategory.category}, at about ${centsToDollars(
          topCategory.amountCents
        )}.`
      : "I do not see enough categorized spending yet.",
    topMerchant
      ? `Your top merchant is ${topMerchant.merchant}, at about ${centsToDollars(
          topMerchant.amountCents
        )}.`
      : "",
    "",
    "You can ask me things like: “Where am I spending the most?”, “Which subscriptions should I review?”, or “Do I have unusual transactions?”",
  ].join("\n");
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body = (await request.json().catch(() => null)) as
      | CoachRequestBody
      | null;

    const organizationId = body?.organizationId;
    const messages = body?.messages ?? [];

    if (!organizationId) {
      return Response.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    const ctx = await requirePermission(
      organizationId,
      "transaction.read.own"
    );

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: ctx.organizationId,
        date: {
          gte: ninetyDaysAgo,
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 250,
      select: {
        amount: true,
        isoCurrencyCode: true,
        date: true,
        name: true,
        merchantName: true,
        customCategory: true,
        pending: true,
      },
    });

    const totalSpendingCents = transactions.reduce((total, transaction) => {
      const amount = Number(transaction.amount);
      return amount > 0 ? total + amount : total;
    }, 0);

    const totalIncomeCents = transactions.reduce((total, transaction) => {
      const amount = Number(transaction.amount);
      return amount < 0 ? total + Math.abs(amount) : total;
    }, 0);

    const pendingCount = transactions.filter(
      (transaction) => transaction.pending
    ).length;

    const topCategories = summarizeByCategory(transactions);
    const topMerchants = summarizeByMerchant(transactions);
    const subscriptions = findSubscriptions(transactions);
    const largeTransactions = findLargeTransactions(transactions);

    const reply = buildCoachReply({
      userMessage: getLastUserMessage(messages),
      transactionCount: transactions.length,
      totalSpendingCents,
      totalIncomeCents,
      pendingCount,
      topCategories,
      topMerchants,
      subscriptions,
      largeTransactions,
    });

    return Response.json({
      reply,
      usedModel: "local-rules",
      evidence: {
        window: "last 90 days",
        transactionCount: transactions.length,
        totalSpendingCents,
        totalIncomeCents,
        netCashFlowCents: totalIncomeCents - totalSpendingCents,
        pendingCount,
        topCategories: topCategories.slice(0, 8),
        topMerchants: topMerchants.slice(0, 8),
        subscriptions,
        largeTransactions,
      },
    });
  });
}
