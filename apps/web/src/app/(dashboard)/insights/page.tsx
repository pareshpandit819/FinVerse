import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { InsightFeedback } from "@/components/insight-feedback";
import { TriggerInsightButton } from "@/components/trigger-insight-button";
import { Lightbulb, AlertTriangle, Info, Sparkles, ChevronRight } from "lucide-react";

const SEVERITY_CONFIG = {
  info:     { variant: "info"        as const, Icon: Info,          ring: "ring-sky-100",  iconBg: "bg-sky-100",    iconText: "text-sky-500" },
  warning:  { variant: "warning"     as const, Icon: AlertTriangle, ring: "ring-amber-100",iconBg: "bg-amber-100",  iconText: "text-amber-500" },
  critical: { variant: "destructive" as const, Icon: AlertTriangle, ring: "ring-rose-100", iconBg: "bg-rose-100",   iconText: "text-rose-500" },
};

const TYPE_LABELS: Record<string, string> = {
  spending_anomaly:       "Spending Anomaly",
  subscription_audit:     "Subscriptions",
  goal_pacing:            "Goal Pacing",
  savings_opportunity:    "Savings",
  budget_breach_forecast: "Budget Alert",
};

export default async function InsightsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const insights = await prisma.insight.findMany({
    where: { organizationId: org.id, userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">AI Insights</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">Personalized analysis powered by Claude</p>
        </div>
        <TriggerInsightButton orgId={org.id} />
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <Lightbulb className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No insights yet</h3>
            <p className="mt-1.5 max-w-xs text-sm text-sky-600/70">
              Insights are generated based on your financial data. Request one to get started.
            </p>
            <div className="mt-5">
              <TriggerInsightButton orgId={org.id} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const cfg = SEVERITY_CONFIG[insight.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
            return (
              <div
                key={insight.id}
                className={`rounded-2xl border border-sky-100 bg-white shadow-sm shadow-sky-100/50 ring-4 ${cfg.ring} transition-all duration-200 hover:shadow-md`}
              >
                {/* Header */}
                <div className="flex items-start gap-4 p-5 pb-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
                    <cfg.Icon className={`h-5 w-5 ${cfg.iconText}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-sky-950 leading-tight">{insight.title}</p>
                      <Badge variant={cfg.variant} className="shrink-0 text-[10px]">{insight.severity}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-sky-500/70">
                      <Sparkles className="h-3 w-3" />
                      {TYPE_LABELS[insight.type] ?? insight.type}
                      <ChevronRight className="h-3 w-3" />
                      {formatDate(insight.generatedAt)}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-sm leading-relaxed text-sky-800/80">{insight.body}</p>

                  {insight.actionItems.length > 0 && (
                    <div className="rounded-xl bg-sky-50 border border-sky-100 p-4">
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-sky-600">
                        Action Items
                      </p>
                      <ul className="space-y-2">
                        {insight.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-sky-800">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <InsightFeedback insightId={insight.id} helpful={insight.helpful} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
