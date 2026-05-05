import { Worker, type Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db/client";
import { InsightJobPayloadSchema } from "@repo/shared/schemas";
import { AI_TOOL_DEFINITIONS } from "@repo/shared/ai-tools";
import { logger } from "@repo/shared/logger";
import { redis } from "../lib/redis.js";
import {
  getAccountSummary,
  getSpendingByCategory,
  getRecurringSubscriptions,
  getGoalProgress,
  getNetWorthTrend,
  findAnomalousTransactions,
  getPortfolioSummary,
  getFinancialHealthIndicators,
} from "../lib/insight-tools.js";

const MODEL_ID = "claude-haiku-4-5-20251001";
const MAX_TOOL_ITERATIONS = 10;
const DAILY_TOKEN_BUDGET = parseInt(process.env["AI_DAILY_TOKEN_BUDGET"] ?? "100000", 10);

const anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

const SYSTEM_PROMPT = `You are a financial wellness assistant for an enterprise financial dashboard.
You have access to aggregated financial data tools. Use them to surface actionable insights.

Guidelines:
- Be concise, specific, and actionable
- Express amounts in dollars (convert from cents by dividing by 100)
- Never speculate about causes; only report what the data shows
- If data is insufficient for a meaningful insight, say so briefly
- Do not include PII, account numbers, or full transaction descriptions

For standard insight types, produce exactly one JSON object:
  { "type": "<insight_type>", "title": "<short title>", "body": "<2-4 sentences>", "severity": "info|warning|critical", "actionItems": ["<step>"] }
  Valid types: spending_anomaly, subscription_audit, goal_pacing, savings_opportunity, budget_breach_forecast, portfolio_insight

For financial_health_report, produce exactly one JSON object:
  {
    "type": "financial_health_report",
    "title": "<short title>",
    "body": "<2-3 sentence executive summary>",
    "severity": "info|warning|critical",
    "actionItems": ["<top recommendation>"],
    "metadata": {
      "healthScore": <0-100 integer>,
      "concerns": [{ "title": "<issue>", "detail": "<1-2 sentences>", "severity": "warning|critical" }],
      "strengths": [{ "title": "<positive>", "detail": "<1-2 sentences>" }],
      "recommendations": [{ "title": "<action>", "detail": "<1-2 sentences>", "priority": "high|medium|low" }]
    }
  }`;

export function createInsightWorker(): Worker {
  return new Worker(
    "insights.generate",
    async (job: Job) => {
      const result = InsightJobPayloadSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error(`Invalid insight job payload: ${JSON.stringify(result.error.issues)}`);
      }

      const { organizationId, userId, insightType } = result.data;
      const log = logger.child({ jobId: job.id, organizationId, userId });

      // Check daily token budget
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const usedToday = await prisma.insight.aggregate({
        where: { userId, generatedAt: { gte: todayStart } },
        _sum: { inputTokens: true, outputTokens: true },
      });

      const tokensUsed = (usedToday._sum.inputTokens ?? 0) + (usedToday._sum.outputTokens ?? 0);
      if (tokensUsed >= DAILY_TOKEN_BUDGET) {
        log.warn({ tokensUsed, budget: DAILY_TOKEN_BUDGET }, "Daily token budget exhausted — skipping insight");
        return;
      }

      const typeHint = insightType
        ? `Focus on generating a "${insightType}" type insight.`
        : "Choose the most impactful insight type based on the data.";

      const userMessage = `${typeHint} Analyze the user's financial data and produce one insight.`;

      const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
      const toolCallLog: Array<{ tool: string; input: unknown; outputLength: number }> = [];

      let totalInput = 0;
      let totalOutput = 0;
      let finalText = "";

      // Agentic loop — Claude calls tools until it produces a final text response
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const response = await anthropic.messages.create({
          model: MODEL_ID,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: AI_TOOL_DEFINITIONS,
          messages,
        });

        totalInput += response.usage.input_tokens;
        totalOutput += response.usage.output_tokens;

        if (response.stop_reason === "end_turn") {
          finalText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          break;
        }

        if (response.stop_reason !== "tool_use") break;

        // Process tool calls
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          const output = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, organizationId);
          toolCallLog.push({ tool: toolUse.name, input: toolUse.input, outputLength: JSON.stringify(output).length });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(output),
          });
        }

        messages.push({ role: "user", content: toolResults });
      }

      if (!finalText) {
        log.warn("Insight worker produced no final text — skipping save");
        return;
      }

      // Extract JSON from Claude's response
      const parsed = extractInsightJson(finalText);
      if (!parsed) {
        log.warn({ finalText }, "Could not parse insight JSON from response — skipping save");
        return;
      }

      const promptHash = createHash("sha256").update(userMessage + MODEL_ID).digest("hex").slice(0, 16);

      await prisma.insight.create({
        data: {
          organizationId,
          userId,
          type: parsed.type,
          title: parsed.title,
          body: parsed.body,
          severity: parsed.severity ?? "info",
          actionItems: parsed.actionItems ?? [],
          metadata: parsed.metadata ?? null,
          toolCallLog,
          modelId: MODEL_ID,
          promptHash,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      log.info(
        { type: parsed.type, inputTokens: totalInput, outputTokens: totalOutput },
        "Insight saved"
      );
    },
    {
      connection: redis,
      concurrency: 2, // limit concurrent Claude calls
    }
  );
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  organizationId: string
): Promise<unknown> {
  switch (name) {
    case "get_account_summary":
      return getAccountSummary(organizationId);

    case "get_spending_by_category":
      return getSpendingByCategory(
        organizationId,
        input["startDate"] as string,
        input["endDate"] as string
      );

    case "get_recurring_subscriptions":
      return getRecurringSubscriptions(organizationId);

    case "get_goal_progress":
      return getGoalProgress(organizationId, input["goalId"] as string | undefined);

    case "get_net_worth_trend":
      return getNetWorthTrend(organizationId, input["period"] as "1m" | "3m" | "6m" | "1y" | "all");

    case "find_anomalous_transactions":
      return findAnomalousTransactions(
        organizationId,
        typeof input["thresholdMultiple"] === "number" ? input["thresholdMultiple"] : 3.0
      );

    case "get_portfolio_summary":
      return getPortfolioSummary(organizationId);

    case "get_financial_health_indicators":
      return getFinancialHealthIndicators(organizationId);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function extractInsightJson(text: string): {
  type: string;
  title: string;
  body: string;
  severity?: string;
  actionItems?: string[];
  metadata?: unknown;
} | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      type?: unknown;
      title?: unknown;
      body?: unknown;
      severity?: unknown;
      actionItems?: unknown;
      metadata?: unknown;
    };

    if (
      typeof parsed.type !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.body !== "string"
    ) {
      return null;
    }

    return {
      type: parsed.type,
      title: parsed.title.slice(0, 200),
      body: parsed.body.slice(0, 2000),
      severity: typeof parsed.severity === "string" ? parsed.severity : "info",
      actionItems: Array.isArray(parsed.actionItems)
        ? (parsed.actionItems as unknown[])
            .filter((i): i is string => typeof i === "string")
            .slice(0, 5)
        : [],
      metadata: parsed.metadata ?? undefined,
    };
  } catch {
    return null;
  }
}
