import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        date: { gte: ninetyDaysAgo },
        pending: false,
        amount: { gt: 0n },
        merchantName: { not: null },
      },
      select: { merchantName: true, amount: true, date: true, customCategory: true },
      orderBy: { date: "asc" },
    });

    const byMerchant = new Map<
      string,
      { amounts: number[]; dates: Date[]; displayName: string; tagged: boolean }
    >();

    for (const txn of transactions) {
      if (!txn.merchantName) continue;
      const key = txn.merchantName.toLowerCase();
      if (!byMerchant.has(key)) {
        byMerchant.set(key, { amounts: [], dates: [], displayName: txn.merchantName, tagged: false });
      }
      const entry = byMerchant.get(key)!;
      entry.amounts.push(Number(txn.amount));
      entry.dates.push(txn.date);
      if (txn.customCategory === "Subscription") entry.tagged = true;
    }

    const subscriptions: {
      merchantName: string;
      displayName: string;
      estimatedMonthlyCents: number;
      lastSeenDate: string;
      transactionCount: number;
      tagged: boolean;
    }[] = [];

    for (const [key, { amounts, dates, displayName, tagged }] of byMerchant) {
      if (amounts.length < 2) continue;
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const maxDeviation = amounts.reduce((d, a) => Math.max(d, Math.abs(a - avg) / avg), 0);
      if (maxDeviation <= 0.1) {
        subscriptions.push({
          merchantName: key,
          displayName,
          estimatedMonthlyCents: Math.round((avg * 30) / (90 / amounts.length)),
          lastSeenDate: dates.at(-1)!.toISOString().split("T")[0]!,
          transactionCount: amounts.length,
          tagged,
        });
      }
    }

    subscriptions.sort((a, b) => b.estimatedMonthlyCents - a.estimatedMonthlyCents);
    const totalMonthlyCents = subscriptions.reduce((s, r) => s + r.estimatedMonthlyCents, 0);

    return Response.json({ subscriptions, totalMonthlyCents });
  });
}
