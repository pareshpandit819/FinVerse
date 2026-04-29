import { NextResponse } from "next/server";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";

// ---------------------------------------------------------------------------
// GET /api/insights?orgId=<uuid>&limit=20
// ---------------------------------------------------------------------------
export async function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId  = searchParams.get("orgId");
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { userId } = await requirePermission(orgId, "insight.read.own");

    const insights = await prisma.insight.findMany({
      where: { organizationId: orgId, userId, expiresAt: { gt: new Date() } },
      orderBy: { generatedAt: "desc" },
      take: limit,
      select: {
        id: true, type: true, title: true, body: true,
        severity: true, actionItems: true, helpful: true, generatedAt: true,
      },
    });

    return NextResponse.json({ insights });
  });
}

// ---------------------------------------------------------------------------
// POST /api/insights — generate directly (Claude if key present, demo otherwise)
// ---------------------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body = await request.json() as { orgId?: string };
    const { orgId } = body;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { userId } = await requirePermission(orgId, "insight.read.own");

    const apiKey = process.env["ANTHROPIC_API_KEY"];

    const insight = apiKey
      ? await generateWithClaude(apiKey, orgId, userId)
      : await saveDemoInsight(orgId, userId);

    return NextResponse.json({ insight }, { status: 201 });
  });
}

// ---------------------------------------------------------------------------
// Real Claude generation — inline, no worker required
// ---------------------------------------------------------------------------
async function generateWithClaude(apiKey: string, orgId: string, userId: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });

  // Gather live context
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const todayStr = new Date().toISOString().split("T")[0]!;
  const startStr  = thirtyDaysAgo.toISOString().split("T")[0]!;

  const [accounts, recentTxns, goals, snapshots] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { organizationId: orgId },
      select: { name: true, type: true, balanceCurrent: true },
    }),
    prisma.transaction.findMany({
      where: { organizationId: orgId, date: { gte: thirtyDaysAgo }, pending: false },
      select: { name: true, amount: true, customCategory: true, date: true },
      orderBy: { date: "desc" },
      take: 40,
    }),
    prisma.goal.findMany({
      where: { organizationId: orgId, userId, isCompleted: false },
      select: { name: true, targetAmount: true, currentAmount: true, targetDate: true },
    }),
    prisma.netWorthSnapshot.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { snapshotDate: "desc" },
      take: 3,
      select: { netWorth: true, snapshotDate: true },
    }),
  ]);

  // Summarise spending by category
  const spending: Record<string, number> = {};
  for (const t of recentTxns) {
    const cat = t.customCategory ?? "Other";
    spending[cat] = (spending[cat] ?? 0) + Number(t.amount);
  }

  const context = JSON.stringify({
    accounts: accounts.map(a => ({ ...a, balanceCurrent: Number(a.balanceCurrent) / 100 })),
    spendingLast30Days: Object.fromEntries(
      Object.entries(spending).map(([k, v]) => [k, `$${(v / 100).toFixed(2)}`])
    ),
    goals: goals.map(g => ({
      name: g.name,
      target: `$${(Number(g.targetAmount) / 100).toFixed(2)}`,
      current: `$${(Number(g.currentAmount) / 100).toFixed(2)}`,
      progressPercent: Math.round(Number(g.currentAmount) / Number(g.targetAmount) * 100),
      dueDate: g.targetDate.toISOString().split("T")[0],
    })),
    netWorthTrend: snapshots.map(s => ({
      date: s.snapshotDate.toISOString().split("T")[0],
      netWorth: `$${(Number(s.netWorth) / 100).toFixed(2)}`,
    })),
  }, null, 2);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `You are a financial wellness assistant. Analyze this personal financial data and return ONE actionable insight.

${context}

Return ONLY a JSON object (no markdown, no extra text):
{
  "type": "spending_anomaly" | "subscription_audit" | "goal_pacing" | "savings_opportunity" | "budget_breach_forecast",
  "title": "<clear title under 80 characters>",
  "body": "<2-3 sentences, specific amounts in dollars, actionable>",
  "severity": "info" | "warning" | "critical",
  "actionItems": ["<concrete step>", "<concrete step>"]
}`,
    }],
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text).join("").trim();

  const match = text.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) as Record<string, unknown> : null;

  if (!parsed?.title || !parsed?.body) {
    throw new Error("Could not parse Claude response");
  }

  return prisma.insight.create({
    data: {
      organizationId: orgId,
      userId,
      type:        String(parsed.type ?? "savings_opportunity"),
      title:       String(parsed.title).slice(0, 200),
      body:        String(parsed.body).slice(0, 2000),
      severity:    ["info","warning","critical"].includes(String(parsed.severity)) ? String(parsed.severity) : "info",
      actionItems: Array.isArray(parsed.actionItems)
        ? (parsed.actionItems as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5)
        : [],
      toolCallLog: [],
      modelId:     "claude-haiku-4-5-20251001",
      promptHash:  "inline",
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Demo fallback — realistic pre-written insights (no API key needed)
// ---------------------------------------------------------------------------
const DEMO_INSIGHTS = [
  {
    type: "budget_breach_forecast",
    severity: "critical",
    title: "Shopping Budget Exceeded by 92% This Month",
    body: "Your Shopping category has reached $1,917.98 against a $1,000.00 budget — driven primarily by the $1,499.99 MacBook Air purchase. You have $0 remaining in this category for the rest of the month.",
    actionItems: [
      "Defer all non-essential purchases until next month's budget resets",
      "Consider raising your Shopping limit to $1,500 to account for tech buys",
      "Check if the MacBook qualifies as a business expense for tax deductions",
    ],
  },
  {
    type: "savings_opportunity",
    severity: "warning",
    title: "Streaming Overlap: Netflix + Hulu = $19.98/mo Redundancy",
    body: "You are currently paying for both Netflix ($15.49) and Hulu ($17.99) — two overlapping video streaming services totalling $33.48/month. Cancelling one would save $215.88 per year.",
    actionItems: [
      "Review your watch history on both services — which did you use more in the last 30 days?",
      "Cancel the less-used service before your next billing cycle",
      "Redirect the $18/month saving directly to your Marcus Savings account",
    ],
  },
  {
    type: "goal_pacing",
    severity: "warning",
    title: "House Down Payment Goal Is Critically Behind Schedule",
    body: "Your House Down Payment goal requires $120,000 but you currently have $26,850 (22%). At $1,000/month you'd reach the target in ~78 months — yet your deadline is only 8 months away. A contribution of ~$11,644/month would be needed to meet the current deadline.",
    actionItems: [
      "Extend the deadline to a realistic 5–7 year horizon",
      "Or significantly increase monthly contributions — consider redirecting your Q2 bonus",
      "Explore high-yield savings accounts for your down payment fund (current rates ~5% APY)",
    ],
  },
  {
    type: "spending_anomaly",
    severity: "info",
    title: "Dining Spend Spiked 34% vs Last Month",
    body: "Food & Dining reached $508.68 this month vs $379.14 last month — an increase of $129.54. The single Sushi Nakazawa charge of $185.00 accounts for most of the spike. You are still within your $800.00 monthly budget.",
    actionItems: [
      "No immediate action needed — you're still under budget",
      "If dining out is increasing, consider a $500 soft cap for restaurant spending",
      "Meal prepping 2 lunches per week could save ~$60/month on food costs",
    ],
  },
  {
    type: "savings_opportunity",
    severity: "info",
    title: "Net Worth Up $11,679 Over 6 Months — Maximize Roth IRA",
    body: "Your net worth grew from $41,400 to $53,079 over the past 6 months, a 28% increase. Your Roth IRA ($42,850) is your largest and fastest-growing asset. You have $2,250 left to contribute before the $7,000 annual limit this year.",
    actionItems: [
      "Contribute $375/month for the next 6 months to hit the $7,000 annual IRA limit",
      "Your emergency fund (Marcus Savings) is at 61% of target — stay consistent at $500/month",
      "Continue your current savings rate — on track to cross $65,000 net worth by year-end",
    ],
  },
];

let demoRound = 0;

async function saveDemoInsight(orgId: string, userId: string) {
  const template = DEMO_INSIGHTS[demoRound % DEMO_INSIGHTS.length]!;
  demoRound++;

  return prisma.insight.create({
    data: {
      organizationId: orgId,
      userId,
      type:        template.type,
      title:       template.title,
      body:        template.body,
      severity:    template.severity,
      actionItems: template.actionItems,
      toolCallLog: [],
      modelId:     "demo",
      promptHash:  "demo",
      inputTokens:  0,
      outputTokens: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}
