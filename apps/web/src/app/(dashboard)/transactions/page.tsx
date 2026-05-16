"use client";

import { useEffect, useMemo, useState } from "react";

const ORGANIZATION_ID = "0b3919a9-85b7-4fb9-869a-4e4bb012a182";

type Transaction = {
  id: string;
  financialAccountId: string;
  organizationId: string;
  amount: string;
  isoCurrencyCode: string;
  date: string;
  name: string;
  merchantName: string | null;
  customCategory: string | null;
  pending: boolean;
  createdAt: string;
  updatedAt: string;
};

type TransactionsResponse = {
  items: Transaction[];
  nextCursor: string | null;
};

const QUICK_CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Subscriptions",
  "Bills & Utilities",
  "Travel & Transport",
  "Health & Wellness",
  "Income",
];

function formatMoney(amountInCents: string, currency: string): string {
  const amount = Number(amountInCents) / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categories = useMemo(() => {
    const dynamicCategories = transactions
      .map((transaction) => transaction.customCategory)
      .filter(Boolean) as string[];

    return Array.from(new Set([...QUICK_CATEGORIES, ...dynamicCategories]));
  }, [transactions]);

  async function fetchTransactions(cursor?: string | null) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        organizationId: ORGANIZATION_ID,
        limit: "50",
      });

      if (search.trim()) {
        params.set("q", search.trim());
      }

      if (category) {
        params.set("customCategory", category);
      }

      if (pending) {
        params.set("pending", pending);
      }

      if (startDate) {
        params.set("startDate", startDate);
      }

      if (endDate) {
        params.set("endDate", endDate);
      }

      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/transactions?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as TransactionsResponse;

      setTransactions((previous) =>
        cursor ? [...previous, ...data.items] : data.items
      );

      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load transactions"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setTransactions([]);
    setNextCursor(null);
    fetchTransactions(null);
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setPending("");
    setStartDate("");
    setEndDate("");
    setTransactions([]);
    setNextCursor(null);

    setTimeout(() => {
      fetchTransactions(null);
    }, 0);
  }

  function handleQuickCategory(nextCategory: string) {
    setCategory(nextCategory);
    setTransactions([]);
    setNextCursor(null);

    setTimeout(() => {
      fetchTransactions(null);
    }, 0);
  }

  function clearQuickCategory() {
    setCategory("");
    setTransactions([]);
    setNextCursor(null);

    setTimeout(() => {
      fetchTransactions(null);
    }, 0);
  }

  function exportCsv() {
    const params = new URLSearchParams({
      organizationId: ORGANIZATION_ID,
      export: "csv",
    });

    if (search.trim()) {
      params.set("q", search.trim());
    }

    if (category) {
      params.set("customCategory", category);
    }

    if (pending) {
      params.set("pending", pending);
    }

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    window.location.href = `/api/transactions?${params.toString()}`;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <p className="text-sm text-slate-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Transactions
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Search, filter, review, and export transaction activity.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchant, name, category"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={pending}
            onChange={(event) => setPending(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All statuses</option>
            <option value="false">Posted</option>
            <option value="true">Pending</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>

            <button
              onClick={resetFilters}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Quick categories
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={clearQuickCategory}
              disabled={loading}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                category === ""
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>

            {QUICK_CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => handleQuickCategory(item)}
                disabled={loading}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  category === item
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={exportCsv}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-950">
            All Transactions
          </h2>
          <p className="text-sm text-slate-500">
            Showing {transactions.length} transactions
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(transaction.date)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-950">
                      {transaction.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {transaction.financialAccountId}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {transaction.merchantName ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {transaction.customCategory ?? "Uncategorized"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        transaction.pending
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {transaction.pending ? "Pending" : "Posted"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right font-semibold text-slate-950">
                    {formatMoney(
                      transaction.amount,
                      transaction.isoCurrencyCode
                    )}
                  </td>
                </tr>
              ))}

              {!loading && transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-4">
          <p className="text-sm text-slate-500">
            {nextCursor ? "More transactions available" : "End of results"}
          </p>

          <button
            disabled={!nextCursor || loading}
            onClick={() => fetchTransactions(nextCursor)}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      </section>
    </main>
  );
}
