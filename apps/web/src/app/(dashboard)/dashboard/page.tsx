import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const ASSET_TYPES = new Set(["checking", "savings", "investment"]);

export default async function DashboardPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const [latestSnapshot, accounts, recentTransactions, activeGoals] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({
      where: { organizationId: org.id },
      orderBy: { snapshotDate: "desc" },
    }),
    prisma.financialAccount.findMany({
      where: { organizationId: org.id },
      orderBy: { type: "asc" },
    }),
    prisma.transaction.findMany({
      where: { organizationId: org.id },
      orderBy: { date: "desc" },
      take: 5,
      include: { account: { select: { name: true } } },
    }),
    prisma.goal.count({ where: { organizationId: org.id, isCompleted: false } }),
  ]);

  const prevSnapshot = latestSnapshot
    ? await prisma.netWorthSnapshot.findFirst({
        where: {
          organizationId: org.id,
          snapshotDate: { lt: latestSnapshot.snapshotDate },
        },
        orderBy: { snapshotDate: "desc" },
      })
    : null;

  const netWorthChange = latestSnapshot && prevSnapshot
    ? latestSnapshot.netWorth - prevSnapshot.netWorth
    : null;

  const totalAccounts = accounts.length;
  const assetAccounts = accounts.filter((a) => ASSET_TYPES.has(a.type));
  const totalBalance = assetAccounts.reduce((s, a) => s + a.balanceCurrent, 0n);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Welcome back, {session.user.name ?? session.user.email}</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSnapshot ? formatCents(latestSnapshot.netWorth) : "—"}
            </div>
            {netWorthChange !== null && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${netWorthChange >= 0n ? "text-green-600" : "text-red-500"}`}>
                {netWorthChange > 0n ? <TrendingUp className="h-3 w-3" /> : netWorthChange < 0n ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {formatCents(netWorthChange < 0n ? -netWorthChange : netWorthChange)} since last
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalBalance)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{totalAccounts} account{totalAccounts !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals}</div>
            <p className="mt-1 text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSnapshot ? formatDate(latestSnapshot.snapshotDate) : "Never"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Net worth snapshot</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Add an account and log your first transaction.</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{txn.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {txn.account.name} · {formatDate(txn.date)}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <p className={`text-sm font-medium ${txn.amount < 0n ? "text-green-600" : ""}`}>
                      {txn.amount < 0n ? "+" : "−"}{formatCents(txn.amount < 0n ? -txn.amount : txn.amount)}
                    </p>
                    {txn.customCategory && (
                      <Badge variant="outline" className="mt-0.5 text-xs">{txn.customCategory}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
