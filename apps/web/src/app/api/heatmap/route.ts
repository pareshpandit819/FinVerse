import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });
    if (month < 1 || month > 12) return Response.json({ error: "invalid month" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        date: { gte: startDate, lte: endDate },
        pending: false,
        amount: { gt: 0n }, // expenses only (positive = expense)
      },
      select: { date: true, amount: true, merchantName: true, name: true },
      orderBy: { date: "asc" },
    });

    const byDate = new Map<
      string,
      { totalCents: number; txCount: number; merchants: Set<string> }
    >();

    for (const txn of transactions) {
      const key = txn.date.toISOString().split("T")[0]!;
      if (!byDate.has(key)) {
        byDate.set(key, { totalCents: 0, txCount: 0, merchants: new Set() });
      }
      const entry = byDate.get(key)!;
      entry.totalCents += Number(txn.amount);
      entry.txCount += 1;
      if (txn.merchantName) entry.merchants.add(txn.merchantName);
      else if (txn.name) entry.merchants.add(txn.name);
    }

    const days: Record<string, { totalCents: number; txCount: number; topMerchants: string[] }> = {};
    for (const [date, entry] of byDate) {
      days[date] = {
        totalCents: entry.totalCents,
        txCount: entry.txCount,
        topMerchants: [...entry.merchants].slice(0, 5),
      };
    }

    return Response.json({ days, year, month });
  });
}
