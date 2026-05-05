import type Anthropic from "@anthropic-ai/sdk";

export const AI_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_account_summary",
    description:
      "Returns aggregated account balances grouped by account type (depository, credit, loan, investment). Does not return account names or numbers.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's UUID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_spending_by_category",
    description:
      "Returns total spending aggregated by Plaid category for a given date range. Amounts are in cents.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        startDate: { type: "string", description: "ISO date string YYYY-MM-DD" },
        endDate: { type: "string", description: "ISO date string YYYY-MM-DD" },
      },
      required: ["userId", "startDate", "endDate"],
    },
  },
  {
    name: "get_recurring_subscriptions",
    description:
      "Detects recurring monthly charges by analyzing transaction patterns. Returns merchant name and estimated monthly cost.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_goal_progress",
    description:
      "Returns progress toward financial goals including projected completion date based on current contribution rate.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        goalId: {
          type: "string",
          description: "Optional. If omitted, returns all goals for the user.",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_net_worth_trend",
    description: "Returns historical net worth snapshots for trend analysis.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        period: {
          type: "string",
          enum: ["1m", "3m", "6m", "1y", "all"],
          description: "Time period to retrieve",
        },
      },
      required: ["userId", "period"],
    },
  },
  {
    name: "find_anomalous_transactions",
    description:
      "Identifies transactions that are statistical outliers vs. the user's normal spending in that category.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        thresholdMultiple: {
          type: "number",
          description: "Transactions exceeding this multiple of category average are flagged. Default 3.0.",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_portfolio_summary",
    description:
      "Returns investment portfolio summary including all holdings, asset class allocation, unrealized gain/loss, and account breakdown. Use this to analyze investment and trading accounts.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's UUID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_financial_health_indicators",
    description:
      "Returns key financial health metrics: savings rate, debt-to-asset ratio, emergency fund coverage months, net worth growth, budget adherence, and portfolio diversification. Use for holistic financial health assessment.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The user's UUID" },
      },
      required: ["userId"],
    },
  },
];
