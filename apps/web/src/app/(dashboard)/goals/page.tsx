import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { projectGoal } from "@repo/shared/goal";
import { formatCents, formatDate, formatBps } from "@/lib/format";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import { Target, CheckCircle2, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export default async function GoalsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const goals = await prisma.goal.findMany({
    where: { organizationId: org.id },
    orderBy: [{ isCompleted: "asc" }, { targetDate: "asc" }],
  });

  const active    = goals.filter(g => !g.isCompleted);
  const completed = goals.filter(g =>  g.isCompleted);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Goals</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            {active.length} active · {completed.length} completed
          </p>
        </div>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <Target className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No goals yet</h3>
            <p className="mt-1.5 text-sm text-sky-600/70">Set financial goals to stay on track.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const monthlyRate = BigInt(Math.round(Number(goal.contributionRate)));
            const projection = projectGoal(
              { targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, targetDate: goal.targetDate },
              monthlyRate > 0n ? monthlyRate : undefined
            );
            const progressPct = Number(projection.progressBps) / 100;
            const isOnTrack = projection.isOnTrack;

            const stateConfig = goal.isCompleted
              ? { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", Icon: CheckCircle2, badge: <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Done</Badge> }
              : isOnTrack === false
                ? { iconBg: "bg-amber-100", iconColor: "text-amber-600", Icon: AlertTriangle, badge: <Badge variant="warning"><AlertTriangle className="h-3 w-3" />At risk</Badge> }
                : isOnTrack === true
                  ? { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", Icon: TrendingUp, badge: <Badge variant="success"><TrendingUp className="h-3 w-3" />On track</Badge> }
                  : { iconBg: "bg-sky-100", iconColor: "text-sky-600", Icon: Target, badge: <Badge variant="secondary">In progress</Badge> };

            return (
              <div
                key={goal.id}
                className={`rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-sky-100/50 transition-all duration-200 hover:shadow-md hover:shadow-sky-100/60 ${goal.isCompleted ? "opacity-75" : ""}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${stateConfig.iconBg}`}>
                      <stateConfig.Icon className={`h-5 w-5 ${stateConfig.iconColor}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sky-950">{goal.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-sky-600/60">
                        <Clock className="h-3 w-3" />
                        Target: {formatDate(goal.targetDate)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">{stateConfig.badge}</div>
                </div>

                <Progress
                  value={progressPct}
                  className={
                    goal.isCompleted ? "[&>div]:bg-emerald-500" :
                    isOnTrack === false ? "[&>div]:bg-amber-400" :
                    "[&>div]:bg-sky-500"
                  }
                />

                <div className="mt-3 flex items-center justify-between text-sm font-medium">
                  <span className="text-sky-600/70">{formatBps(projection.progressBps)} saved</span>
                  <span className="tabular-nums tracking-tight text-sky-950">
                    {formatCents(goal.currentAmount)}
                    <span className="font-normal text-sky-400/70"> / {formatCents(goal.targetAmount)}</span>
                  </span>
                </div>

                {!goal.isCompleted && (
                  <div className="mt-2 flex items-center justify-between text-xs font-medium text-sky-600/60">
                    {projection.daysRemaining > 0 && <span>{projection.daysRemaining} days remaining</span>}
                    {monthlyRate > 0n && (
                      <span className="text-sky-700">{formatCents(projection.requiredMonthlyContribution)}/mo needed</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
