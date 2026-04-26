# ADR-0006: Tool-use agentic loop for AI insights over single-shot prompting

## Status
Accepted

## Context
The AI insights feature must analyze a user's financial data to produce actionable, data-grounded insights. Two approaches: (1) fetch all relevant data upfront, stuff it into a single prompt; (2) give the model tools to query for what it needs.

## Decision
Use Claude's **tool use** capability with an **agentic loop** (multi-turn, max 8 tool calls per session). The model decides which data it needs and calls typed tool functions to retrieve aggregated numbers.

## Rationale
- **Data minimization by design**: The model only fetches what it needs. A spending-anomaly insight doesn't pull net worth history.
- **Grounded outputs**: Tool call results appear in the conversation as cited evidence, making the insight traceable back to specific data points (stored in `Insight.toolCallLog`).
- **Adaptable analysis**: The model can follow up on surprising data (e.g., spot an anomaly in category X, then call `get_spending_by_category` for adjacent months to confirm a trend).
- **PII control**: Tool functions return aggregated/derived numbers. Raw merchant names and account numbers never enter the LLM context unless explicitly needed and approved.
- **Cost efficiency**: Haiku 4.5 is used for classification sub-tasks (e.g., categorizing a merchant type) within the same loop; Sonnet 4.6 for reasoning.

## Tool Inventory
| Tool | Returns | PII Risk |
|------|---------|----------|
| `get_account_summary` | Balances by account type (no names/numbers) | Low |
| `get_spending_by_category` | Aggregated spend per category for a date range | Low |
| `get_recurring_subscriptions` | Merchant name + monthly cost for detected subscriptions | Medium — merchant names included |
| `get_goal_progress` | Goal name, target, current, projected completion | Low |
| `get_net_worth_trend` | Net worth over time (no account breakdown) | Low |
| `find_anomalous_transactions` | Merchant name + amount for outliers above threshold | Medium — merchant names included |

For `get_recurring_subscriptions` and `find_anomalous_transactions`, merchant names are included because they are necessary for the insight to be actionable. The system prompt instructs the model to reference merchants only by category in the final insight body.

## Guardrails
1. **Max 8 tool calls per session** — prevents runaway loops.
2. **Output Zod validation** — model output parsed against `InsightSchema` before persistence. Invalid output → discard + log.
3. **Hard refusal patterns** — system prompt includes explicit instructions; any output containing "buy", "sell", "invest in [specific asset]" is caught by a post-processing regex filter and replaced with a canned disclaimer.
4. **Token budget** — per-user daily token cap enforced before the loop starts. Exceeded budget → skip insight generation, queue for next day.
5. **Provenance** — `Insight.toolCallLog` stores the full sequence of tool calls and results. `Insight.promptHash` stores a hash of the system prompt version.

## Alternatives Considered
- **Single-shot prompting with full context dump**: Simpler, but risks sending PII, hits token limits for users with many transactions, and produces less traceable outputs.
- **RAG (embedding-based retrieval)**: Good for document-heavy use cases. Financial data is structured, not unstructured — tool functions are a better fit.
- **Fine-tuned model**: Expensive, requires labeled training data, hard to update. Tool use is more maintainable.

## Consequences
- The insight worker is stateful across multiple Claude API calls (the conversation array grows per session).
- Tool function implementations in `packages/shared/src/ai-tools/` must be thoroughly tested — they are the source of truth the model reasons over.
- Prompt version changes require incrementing the prompt hash and may invalidate stored insights (handled by `expiresAt`).
