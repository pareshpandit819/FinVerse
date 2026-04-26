import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { NetWorthChart } from "@/components/net-worth-chart";
import { TrendingUp, TrendingDown } from "lucide-react";

export default async function NetWorthPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { organizationId: org.id },
    orderBy: { snapshotDate: "asc" },
    take: 365,
    select: {
      snapshotDate: true,
      netWorth: true,
      totalAssets: true,
      totalLiabilities: true,
      breakdown: true,
    },
  });

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  const oldest = snapshots[0];

  const change30d = latest && previous ? latest.netWorth - previous.netWorth : null;
  const changeAllTime = latest && oldest && latest !== oldest ? latest.netWorth - oldest.netWorth : null;

  const chartData = snapshots.map((s) => ({
    date: s.snapshotDate.toISOString().split("T")[0]!,
    netWorth: Number(s.netWorth),
    assets: Number(s.totalAssets),
    liabilities: Number(s.totalLiabilities),
  }));

  const breakdown = latest?.breakdown as Record<string, number> | null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Net Worth</h1>
        <p className="text-sm text-muted-foreground">
          {latest ? `As of ${formatDate(latest.snapshotDate)}` : "No snapshots yet"}
        </p>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {latest ? formatCents(latest.netWorth) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Change (last period)</CardTitle>
          </CardHeader>
          <CardContent>
            {change30d !== null ? (
              <div className={`flex items-center gap-2 text-2xl font-bold ${change30d >= 0n ? "text-green-600" : "text-red-500"}`}>
                {change30d >= 0n ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {change30d < 0n ? "-" : "+"}{formatCents(change30d < 0n ? -change30d : change30d)}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">All-Time Change</CardTitle>
          </CardHeader>
          <CardContent>
            {changeAllTime !== null ? (
              <div className={`flex items-center gap-2 text-2xl font-bold ${changeAllTime >= 0n ? "text-green-600" : "text-red-500"}`}>
                {changeAllTime >= 0n ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {changeAllTime < 0n ? "-" : "+"}{formatCents(changeAllTime < 0n ? -changeAllTime : changeAllTime)}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <NetWorthChart data={chartData} />
          <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-6 bg-primary" />
              Net Worth
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-6 bg-green-500" style={{ borderTop: "2px dashed" }} />
              Assets
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-6 bg-red-500" style={{ borderTop: "2px dashed" }} />
              Liabilities
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      {breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(breakdown)
                .filter(([, v]) => v !== 0)
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{key}</span>
                    <span className={`font-medium ${key === "credit" || key === "loans" ? "text-red-500" : ""}`}>
                      {key === "credit" || key === "loans" ? "-" : ""}{formatCents(value)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
