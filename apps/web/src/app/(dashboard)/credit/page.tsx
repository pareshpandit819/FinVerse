import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { CreditHistoryChart } from "@/components/credit-history-chart";
import { CreditFactors } from "@/components/credit-factors";
import { CreditAccounts } from "@/components/credit-accounts";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function CreditPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  // Fetch credit scores
  const creditScores = await prisma.creditScore.findMany({
    where: { organizationId: org.id, userId: session.user.id },
    orderBy: { scoreDate: "asc" },
    take: 365,
  });

  // Fetch credit accounts
  const creditAccounts = await prisma.creditAccount.findMany({
    where: { organizationId: org.id, userId: session.user.id },
    orderBy: { openDate: "desc" },
  });

  // Fetch credit history with account info
  const creditHistoryRaw = await prisma.creditHistory.findMany({
    where: { organizationId: org.id, userId: session.user.id },
    orderBy: { eventDate: "desc" },
    take: 50,
  });

  // Map credit history to include account names
  const creditHistory = creditHistoryRaw.map((event) => {
    const account = creditAccounts.find((acc) => acc.id === event.creditAccountId);
    return {
      ...event,
      accountName: account?.accountName || "Unknown Account",
    };
  });

  // Get latest credit score
  const latestScore = creditScores[creditScores.length - 1];
  const previousScore = creditScores[creditScores.length - 2];
  const scoreChange = latestScore && previousScore ? latestScore.score - previousScore.score : null;

  // Calculate total credit limits and balances
  const totalCreditLimit = creditAccounts.reduce((sum, acc) => sum + (acc.creditLimit || 0n), 0n);
  const totalBalance = creditAccounts.reduce((sum, acc) => sum + acc.balance, 0n);
  const creditUtilization = totalCreditLimit > 0n ? Number((totalBalance * 100n) / totalCreditLimit) : 0;

  // Calculate delinquent accounts
  const delinquentAccounts = creditAccounts.filter((acc) =>
    ["30_days_late", "60_days_late", "late"].includes(acc.paymentStatus)
  ).length;

  // Chart data
  const chartData = creditScores.map((score) => ({
    date: score.scoreDate.toISOString().split("T")[0]!,
    score: score.score,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credit Score & History</h1>
        <p className="text-sm text-muted-foreground">
          {latestScore ? `Current score as of ${latestScore.scoreDate.toLocaleDateString()}` : "Track your credit score and accounts"}
        </p>
      </div>

      {/* Credit Score Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {latestScore ? latestScore.score : "—"}
            </div>
            {scoreChange !== null && (
              <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${scoreChange >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {scoreChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {scoreChange > 0 ? "+" : ""}{scoreChange} points
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credit Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${creditUtilization > 70 ? "text-rose-600" : "text-emerald-600"}`}>
              {creditUtilization.toFixed(1)}%
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              of available credit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{creditAccounts.length}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              {creditAccounts.filter((a) => a.accountStatus === "open").length} open
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              {delinquentAccounts > 0 && <AlertCircle className="h-4 w-4 text-rose-500" />}
              Delinquent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${delinquentAccounts > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {delinquentAccounts}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credit History Chart */}
        <div className="lg:col-span-2">
          <CreditHistoryChart data={chartData} />
        </div>

        {/* Credit Factors */}
        <CreditFactors
          data={{
            paymentHistory: latestScore?.paymentHistory ?? 0,
            creditUtilization: latestScore?.creditUtilization ?? creditUtilization,
            creditAge: latestScore?.creditAge ?? 0,
            derogatoryMarks: latestScore?.derogatoryMarks ?? 0,
            hardInquiries: latestScore?.hardInquiries ?? 0,
            totalAccounts: latestScore?.totalAccounts ?? creditAccounts.length,
          }}
        />
      </div>

      {/* Credit Accounts */}
      <CreditAccounts accounts={creditAccounts} />

      {/* Recent Credit History */}
      {creditHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Credit Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditHistory.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg border border-sky-200 p-3 hover:bg-sky-50/50 transition-colors"
                >
                  <div className="mt-0.5 flex h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-sky-950">{formatEventType(event.eventType)}</p>
                    <p className="text-xs text-sky-600 font-medium">{event.accountName}</p>
                    <p className="text-xs text-sky-600 line-clamp-2">{event.eventDescription}</p>
                    <p className="mt-1 text-xs text-sky-500/70">
                      {event.eventDate.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
