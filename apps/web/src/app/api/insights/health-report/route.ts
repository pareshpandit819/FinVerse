import { NextResponse } from "next/server";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";

// POST /api/insights/health-report
// Generates a structured financial health report with concerns, strengths, and recommendations.
export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body = await request.json() as { orgId?: string };
    const { orgId } = body;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { userId } = await requirePermission(orgId, "insight.read.own");

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    const insight = apiKey
      ? await generateHealthReport(apiKey, orgId, userId)
      : await saveDemoHealthReport(orgId, userId);

    return NextResponse.json({ insight }, { status: 201 });
  });
}

async function generateHealthReport(apiKey: string, orgId: string, userId: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oneEightyDaysAgo = new Date();
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

  const [accounts, recentTxns, goals, snapshots, latestBudget, holdings] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { organizationId: orgId },
      select: { name: true, type: true, subtype: true, balanceCurrent: true },
    }),
    prisma.transaction.findMany({
      where: { organizationId: orgId, date: { gte: thirtyDaysAgo }, pending: false },
      select: { amount: true, customCategory: true },
    }),
    prisma.goal.findMany({
      where: { organizationId: orgId, userId, isCompleted: false },
      select: { name: true, targetAmount: true, currentAmount: true, targetDate: true },
    }),
    prisma.netWorthSnapshot.findMany({
      where: { organizationId: orgId, userId, snapshotDate: { gte: oneEightyDaysAgo } },
      orderBy: { snapshotDate: "desc" },
      take: 6,
      select: { netWorth: true, snapshotDate: true, totalAssets: true, totalLiabilities: true },
    }),
    prisma.budget.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: { categories: true },
    }),
    prisma.holding.findMany({
      where: { organizationId: orgId },
      select: {
        institutionValue: true,
        costBasis: true,
        security: { select: { name: true, tickerSymbol: true, type: true } },
      },
    }),
  ]);

  const income = recentTxns.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const spending = recentTxns.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);

  const context = JSON.stringify({
    accounts: accounts.map(a => ({
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balanceDollars: (Number(a.balanceCurrent) / 100).toFixed(2),
    })),
    last30Days: {
      incomeDollars: (income / 100).toFixed(2),
      spendingDollars: (spending / 100).toFixed(2),
      savingsRatePercent: income > 0 ? ((income - spending) / income * 100).toFixed(1) : null,
    },
    goals: goals.map(g => ({
      name: g.name,
      targetDollars: (Number(g.targetAmount) / 100).toFixed(2),
      currentDollars: (Number(g.currentAmount) / 100).toFixed(2),
      progressPercent: Math.round(Number(g.currentAmount) / Number(g.targetAmount) * 100),
      dueDate: g.targetDate.toISOString().split("T")[0],
    })),
    netWorthSnapshots: snapshots.map(s => ({
      date: s.snapshotDate.toISOString().split("T")[0],
      netWorthDollars: (Number(s.netWorth) / 100).toFixed(2),
      assetsDollars: (Number(s.totalAssets) / 100).toFixed(2),
      liabilitiesDollars: (Number(s.totalLiabilities) / 100).toFixed(2),
    })),
    budget: latestBudget
      ? {
          categories: latestBudget.categories.map(c => ({
            category: c.category,
            limitDollars: (Number(c.limitAmount) / 100).toFixed(2),
            spentDollars: (Number(c.spentAmount) / 100).toFixed(2),
            overBudget: Number(c.spentAmount) > Number(c.limitAmount),
          })),
        }
      : null,
    portfolio: holdings.length > 0
      ? {
          holdingCount: holdings.length,
          totalValueDollars: (holdings.reduce((s, h) => s + Number(h.institutionValue), 0) / 100).toFixed(2),
          holdings: holdings.slice(0, 10).map(h => ({
            name: h.security.name,
            ticker: h.security.tickerSymbol,
            type: h.security.type,
            valueDollars: (Number(h.institutionValue) / 100).toFixed(2),
          })),
        }
      : null,
  }, null, 2);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `You are a financial wellness assistant. Analyze this user's complete financial picture and produce a structured health report.

${context}

Return ONLY a JSON object (no markdown, no extra text):
{
  "type": "financial_health_report",
  "title": "<title under 80 chars>",
  "body": "<2-3 sentence executive summary>",
  "severity": "info" | "warning" | "critical",
  "actionItems": ["<most important action>", "<second action>"],
  "metadata": {
    "healthScore": <0-100 integer — overall financial health>,
    "concerns": [
      { "title": "<issue title>", "detail": "<1-2 sentences with specific numbers>", "severity": "warning" | "critical" }
    ],
    "strengths": [
      { "title": "<positive title>", "detail": "<1-2 sentences with specific numbers>" }
    ],
    "recommendations": [
      { "title": "<action title>", "detail": "<1-2 sentences, specific and actionable>", "priority": "high" | "medium" | "low" }
    ]
  }
}

Include 2-4 concerns, 2-4 strengths, and 3-5 recommendations. Base everything strictly on the data provided.`,
    }],
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text).join("").trim();

  const match = text.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) as Record<string, unknown> : null;

  if (!parsed?.title || !parsed?.body) throw new Error("Could not parse Claude response");

  return prisma.insight.create({
    data: {
      organizationId: orgId,
      userId,
      type: "financial_health_report",
      title: String(parsed.title).slice(0, 200),
      body: String(parsed.body).slice(0, 2000),
      severity: ["info", "warning", "critical"].includes(String(parsed.severity)) ? String(parsed.severity) : "info",
      actionItems: Array.isArray(parsed.actionItems)
        ? (parsed.actionItems as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5)
        : [],
      metadata: (parsed.metadata as object) ?? null,
      toolCallLog: [],
      modelId: "claude-sonnet-4-6",
      promptHash: "health-report",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

async function saveDemoHealthReport(orgId: string, userId: string) {
  return prisma.insight.create({
    data: {
      organizationId: orgId,
      userId,
      type: "financial_health_report",
      title: "Your Financial Health Report: Score 68 / 100",
      body: "Your overall financial health is moderate. You have positive net worth growth and a good savings rate, but high credit utilization and a behind-schedule emergency fund are areas that need attention. Three targeted actions could meaningfully improve your score.",
      severity: "warning",
      actionItems: [
        "Pay down credit card balances to below 30% utilization",
        "Automate $500/month to Marcus Savings for emergency fund",
        "Increase Roth IRA contribution to hit the $7,000 annual limit",
      ],
      metadata: {
        healthScore: 68,
        concerns: [
          {
            title: "High Credit Utilization",
            detail: "Your credit utilization is at 62% — above the recommended 30% threshold. This is actively suppressing your credit score and costing you in higher interest rates.",
            severity: "warning",
          },
          {
            title: "Emergency Fund Below Target",
            detail: "Your liquid savings cover only 2.1 months of expenses. Financial best practice is 3-6 months. A gap event (job loss, medical bill) could force high-interest debt.",
            severity: "warning",
          },
          {
            title: "House Goal Critically Off-Pace",
            detail: "At your current contribution rate, your House Down Payment goal will be reached in 6.5 years — but your target date is 8 months away.",
            severity: "critical",
          },
        ],
        strengths: [
          {
            title: "Strong Savings Rate",
            detail: "You saved 22% of your income last month — well above the recommended 20%. This habit is the foundation of long-term wealth.",
          },
          {
            title: "Net Worth Growing Steadily",
            detail: "Your net worth grew 18% over the past 6 months, from $42,000 to $49,600. At this pace you'll cross $60K by year-end.",
          },
          {
            title: "Roth IRA on Track",
            detail: "Your Roth IRA ($42,850) is your fastest-growing asset with $2,250 remaining to hit this year's $7,000 contribution limit.",
          },
        ],
        recommendations: [
          {
            title: "Attack Highest-Interest Debt First",
            detail: "Redirect $300/month to your Chase Sapphire balance (24.9% APR). This saves ~$680/year in interest and drops your utilization below 30% within 4 months.",
            priority: "high",
          },
          {
            title: "Automate Emergency Fund Contributions",
            detail: "Set up a $500/month auto-transfer to a high-yield savings account. At 5% APY you reach the 6-month target in under 8 months.",
            priority: "high",
          },
          {
            title: "Revisit Your House Down Payment Timeline",
            detail: "Extend your target date to a realistic 4-5 years or explore lower down payment options (3.5% FHA) to make the goal achievable without financial strain.",
            priority: "medium",
          },
          {
            title: "Max Out Roth IRA Before Year-End",
            detail: "Contribute the remaining $2,250 over the next 3 months ($750/month). Tax-free growth on this compounded over 30 years is worth $18,000+ in today's dollars.",
            priority: "medium",
          },
          {
            title: "Review Streaming Subscriptions",
            detail: "You're paying for Netflix, Hulu, and Disney+ simultaneously — $47.47/month. Consolidating to one platform saves $356/year you can redirect to goals.",
            priority: "low",
          },
        ],
      },
      toolCallLog: [],
      modelId: "demo",
      promptHash: "demo-health",
      inputTokens: 0,
      outputTokens: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}
