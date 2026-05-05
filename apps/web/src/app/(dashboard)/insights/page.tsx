import React from "react";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { InsightFeedback } from "@/components/insight-feedback";
import { TriggerInsightButton } from "@/components/trigger-insight-button";
import { HealthReportButton } from "@/components/trading/health-report-button";
import {
  Lightbulb, AlertTriangle, Info, Sparkles, ChevronRight,
  HeartPulse, CheckCircle2, AlertCircle, ArrowRight,
} from "lucide-react";

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
  portfolio_insight:      "Portfolio",
  financial_health_report:"Health Report",
};

type HealthMetaConcern = { title: string; detail: string; severity: "warning" | "critical" };
type HealthMetaStrength = { title: string; detail: string };
type HealthMetaRecommendation = { title: string; detail: string; priority: "high" | "medium" | "low" };
type HealthMeta = {
  healthScore?: number;
  concerns?: HealthMetaConcern[];
  strengths?: HealthMetaStrength[];
  recommendations?: HealthMetaRecommendation[];
};

const PRIORITY_CONFIG = {
  high:   { label: "High",   cls: "bg-rose-100 text-rose-700" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700" },
  low:    { label: "Low",    cls: "bg-sky-100 text-sky-700" },
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
        <div className="flex items-center gap-2">
          <HealthReportButton orgId={org.id} />
          <TriggerInsightButton orgId={org.id} />
        </div>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <Lightbulb className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No insights yet</h3>
            <p className="mt-1.5 max-w-xs text-sm text-sky-600/70">
              Generate a health report for a full financial assessment, or request a quick insight.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <HealthReportButton orgId={org.id} />
              <TriggerInsightButton orgId={org.id} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const isHealthReport = insight.type === "financial_health_report";
            const healthMeta = isHealthReport ? (insight.metadata as HealthMeta | null) : null;
            const cfg = SEVERITY_CONFIG[insight.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;

            if (isHealthReport && healthMeta) {
              return (
                <React.Fragment key={insight.id}>
                  <HealthReportCard
                    insight={{
                      id: insight.id,
                      title: insight.title,
                      body: insight.body,
                      severity: insight.severity,
                      actionItems: insight.actionItems as string[],
                      generatedAt: insight.generatedAt,
                      helpful: insight.helpful,
                    }}
                    healthMeta={healthMeta}
                  />
                </React.Fragment>
              );
            }

            return (
              <div
                key={insight.id}
                className={`rounded-2xl border border-sky-100 bg-white shadow-sm shadow-sky-100/50 ring-4 ${cfg.ring} transition-all duration-200 hover:shadow-md`}
              >
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

                <div className="px-5 pb-5 space-y-4">
                  <p className="text-sm leading-relaxed text-sky-800/80">{insight.body}</p>

                  {(insight.actionItems as string[]).length > 0 && (
                    <div className="rounded-xl bg-sky-50 border border-sky-100 p-4">
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-sky-600">Action Items</p>
                      <ul className="space-y-2">
                        {(insight.actionItems as string[]).map((item, i) => (
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

// ---------------------------------------------------------------------------
// Financial Health Report card — rich structured layout
// ---------------------------------------------------------------------------

interface HealthReportCardProps {
  insight: {
    id: string;
    title: string;
    body: string;
    severity: string;
    actionItems: string[];
    generatedAt: Date;
    helpful: boolean | null;
  };
  healthMeta: HealthMeta;
}

function HealthReportCard({ insight, healthMeta }: HealthReportCardProps) {
  const score = healthMeta.healthScore ?? null;
  const scoreColor =
    score === null ? "bg-sky-500"
    : score >= 80 ? "bg-emerald-500"
    : score >= 60 ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className={`rounded-2xl border border-violet-200 bg-white shadow-sm shadow-violet-100/50 ring-4 ring-violet-100 transition-all duration-200 hover:shadow-md`}>

      {/* Header */}
      <div className="flex items-start gap-4 p-5 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <HeartPulse className="h-5 w-5 text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-sky-950 leading-tight">{insight.title}</p>
            <Badge variant="secondary" className="shrink-0 bg-violet-100 text-violet-700 text-[10px]">Health Report</Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-sky-500/70">
            <Sparkles className="h-3 w-3" />
            AI Analysis
            <ChevronRight className="h-3 w-3" />
            {formatDate(insight.generatedAt)}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-5">

        {/* Score + summary */}
        <div className="flex items-center gap-4">
          {score !== null && (
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${scoreColor} text-2xl font-bold text-white shadow-sm`}>
              {score}
            </div>
          )}
          <div>
            <p className="text-sm leading-relaxed text-sky-800/80">{insight.body}</p>
            {score !== null && (
              <p className="mt-1 text-xs font-semibold text-sky-500/60">
                {score >= 80 ? "Excellent financial health" : score >= 60 ? "Good — room to improve" : "Needs attention — act on concerns below"}
              </p>
            )}
          </div>
        </div>

        {/* Three-column grid: concerns / strengths / recommendations */}
        <div className="grid gap-4 sm:grid-cols-3">

          {/* Concerns */}
          {(healthMeta.concerns?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Areas of Concern
              </p>
              <ul className="space-y-3">
                {healthMeta.concerns!.map((c, i) => (
                  <li key={i}>
                    <p className="text-xs font-semibold text-rose-800">{c.title}</p>
                    <p className="mt-0.5 text-xs text-rose-700/70 leading-relaxed">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strengths */}
          {(healthMeta.strengths?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Doing Well
              </p>
              <ul className="space-y-3">
                {healthMeta.strengths!.map((s, i) => (
                  <li key={i}>
                    <p className="text-xs font-semibold text-emerald-800">{s.title}</p>
                    <p className="mt-0.5 text-xs text-emerald-700/70 leading-relaxed">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {(healthMeta.recommendations?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sky-600">
                <ArrowRight className="h-3.5 w-3.5" />
                Recommendations
              </p>
              <ul className="space-y-3">
                {healthMeta.recommendations!.map((r, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold text-sky-800 flex-1">{r.title}</p>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIORITY_CONFIG[r.priority]?.cls ?? PRIORITY_CONFIG.medium.cls}`}>
                        {PRIORITY_CONFIG[r.priority]?.label ?? r.priority}
                      </span>
                    </div>
                    <p className="text-xs text-sky-700/70 leading-relaxed">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Top action items */}
        {insight.actionItems.length > 0 && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-violet-600">Immediate Actions</p>
            <ul className="space-y-2">
              {insight.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-violet-800">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
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
}
