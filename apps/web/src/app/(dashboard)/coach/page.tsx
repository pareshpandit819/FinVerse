"use client";

import { FormEvent, useState } from "react";

const ORGANIZATION_ID = "0b3919a9-85b7-4fb9-869a-4e4bb012a182";

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachResponse = {
  reply: string;
  usedModel: "local-rules";
  evidence?: {
    window: string;
    transactionCount: number;
    totalSpendingCents: number;
    totalIncomeCents: number;
    netCashFlowCents: number;
    pendingCount: number;
    topCategories: Array<{
      category: string;
      amountCents: number;
    }>;
    topMerchants: Array<{
      merchant: string;
      amountCents: number;
      count: number;
    }>;
    subscriptions: Array<{
      name: string;
      merchant: string;
      amountCents: number;
      date: string;
    }>;
    largeTransactions: Array<{
      name: string;
      merchant: string;
      category: string;
      amountCents: number;
      date: string;
    }>;
  };
};

const STARTER_QUESTIONS = [
  "How am I doing?",
  "Where am I spending the most?",
  "Which subscriptions should I review?",
  "Do I have any unusual transactions?",
  "How can I reduce spending this week?",
];

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(cents) / 100);
}

function formatCashFlow(cents: number): string {
  const prefix = cents >= 0 ? "+" : "-";
  return `${prefix}${formatMoney(cents)}`;
}

export default function CoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m your AI financial coach. Ask me about your spending, income, subscriptions, or unusual transactions.",
    },
  ]);

  const [input, setInput] = useState("");
  const [evidence, setEvidence] = useState<CoachResponse["evidence"] | null>(
    null
  );
  const [usedModel, setUsedModel] = useState<"local-rules" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(messageText?: string) {
    const content = (messageText ?? input).trim();

    if (!content || loading) return;

    const nextMessages: CoachMessage[] = [
      ...messages,
      {
        role: "user",
        content,
      },
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as CoachResponse;

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);

      setEvidence(data.evidence ?? null);
      setUsedModel(data.usedModel);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not contact coach API"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <main className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <section className="flex min-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-sm text-slate-500">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            AI Financial Coach
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ask questions about your recent spending, income, subscriptions,
            and financial habits. This version runs locally using rules and your
            transaction data.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Reviewing your recent financial activity...
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendMessage(question)}
                disabled={loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask your financial coach..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Financial context
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The coach uses your recent transaction data as evidence.
          </p>

          {evidence ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Transactions"
                  value={String(evidence.transactionCount)}
                />
                <MetricCard
                  label="Pending"
                  value={String(evidence.pendingCount)}
                />
                <MetricCard
                  label="Spending"
                  value={formatMoney(evidence.totalSpendingCents)}
                />
                <MetricCard
                  label="Income"
                  value={formatMoney(evidence.totalIncomeCents)}
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Net cash flow</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    evidence.netCashFlowCents >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {formatCashFlow(evidence.netCashFlowCents)}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Top categories
                </h3>
                <div className="mt-2 space-y-2">
                  {evidence.topCategories.slice(0, 5).map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-slate-600">
                        {item.category}
                      </span>
                      <span className="font-medium text-slate-950">
                        {formatMoney(item.amountCents)}
                      </span>
                    </div>
                  ))}

                  {evidence.topCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No category data available.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Top merchants
                </h3>
                <div className="mt-2 space-y-2">
                  {evidence.topMerchants.slice(0, 5).map((item) => (
                    <div
                      key={item.merchant}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-slate-600">
                        {item.merchant}
                      </span>
                      <span className="font-medium text-slate-950">
                        {formatMoney(item.amountCents)}
                      </span>
                    </div>
                  ))}

                  {evidence.topMerchants.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No merchant data available.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Subscription-like charges
                </h3>
                <div className="mt-2 space-y-2">
                  {evidence.subscriptions.slice(0, 5).map((item) => (
                    <div
                      key={`${item.merchant}-${item.date}-${item.amountCents}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-slate-600">
                        {item.merchant}
                      </span>
                      <span className="font-medium text-slate-950">
                        {formatMoney(item.amountCents)}
                      </span>
                    </div>
                  ))}

                  {evidence.subscriptions.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No subscription-like charges found.
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Mode:{" "}
                {usedModel === "local-rules"
                  ? "Local finance rules"
                  : "Not loaded"}
              </p>
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Ask a question to load the evidence panel.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Safety note</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            This coach is for budgeting and financial awareness. It is not
            legal, tax, or investment advice.
          </p>
        </section>
      </aside>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
