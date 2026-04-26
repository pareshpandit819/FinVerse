import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { calculateBudget } from "@repo/shared/budget";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import { PieChart, TrendingDown, CheckCircle2 } from "lucide-react";

export default async function BudgetsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const budget = await prisma.budget.findFirst({
    where: { organizationId: org.id, userId: session.user.id, month, year },
    include: { categories: { orderBy: { category: "asc" } } },
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

  if (!budget) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Budgets</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">{monthName} {year}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <PieChart className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No budget for this month</h3>
            <p className="mt-1.5 text-sm text-sky-600/70">Create a budget to start tracking spending by category.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const budgetResult = calculateBudget(
    budget.categories.map(c => ({ category: c.category, limitAmount: c.limitAmount, spentAmount: c.spentAmount, rolloverCarryIn: 0n })),
    budget.rollover
  );

  const totalUtilPct = budgetResult.totalLimit > 0n
    ? Number((budgetResult.totalSpent * 100n) / budgetResult.totalLimit)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Budgets</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            {budget.name} · {monthName} {year}
          </p>
        </div>
        <Badge variant={budgetResult.isBreached ? "destructive" : "success"}>
          {budgetResult.isBreached
            ? <><TrendingDown className="h-3 w-3" /> Over budget</>
            : <><CheckCircle2 className="h-3 w-3" /> On track</>}
        </Badge>
      </div>

      {/* Summary card */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-sky-700">Monthly Spending</p>
            <p className="text-sm font-bold tabular-nums text-sky-950">
              {formatCents(budgetResult.totalSpent)}
              <span className="ml-1 font-medium text-sky-400/70">/ {formatCents(budgetResult.totalLimit)}</span>
            </p>
          </div>
          <Progress
            value={totalUtilPct}
            className={totalUtilPct > 100 ? "[&>div]:bg-rose-400" : "[&>div]:bg-sky-500"}
          />
          <p className="mt-2 text-xs font-medium text-sky-600/70">{totalUtilPct.toFixed(0)}% of budget used</p>
        </CardContent>
      </Card>

      {/* Category grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgetResult.categories.map((cat) => {
          const utilPct = Number(cat.utilizationBps) / 100;
          const isOver = cat.isBreached;
          const isWarn = !isOver && utilPct > 80;

          return (
            <div
              key={cat.category}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                isOver ? "border-rose-200 shadow-rose-100/50" :
                isWarn ? "border-amber-200 shadow-amber-100/50" :
                         "border-sky-100 shadow-sky-100/50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-sky-950">{cat.category}</p>
                {isOver
                  ? <Badge variant="destructive" className="text-[10px]">Over</Badge>
                  : isWarn
                    ? <Badge variant="warning" className="text-[10px]">Near limit</Badge>
                    : <Badge variant="success" className="text-[10px]">OK</Badge>}
              </div>
              <Progress
                value={Math.min(utilPct, 100)}
                className={
                  isOver ? "[&>div]:bg-rose-400" :
                  isWarn ? "[&>div]:bg-amber-400" :
                           "[&>div]:bg-emerald-500"
                }
              />
              <div className="mt-2.5 flex items-center justify-between text-xs font-medium">
                <span className="text-sky-600/70">{formatCents(cat.spentAmount)} spent</span>
                <span className={isOver ? "text-rose-500" : "text-emerald-600"}>
                  {isOver
                    ? `${formatCents(cat.overage)} over`
                    : `${formatCents(cat.remaining)} left`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
