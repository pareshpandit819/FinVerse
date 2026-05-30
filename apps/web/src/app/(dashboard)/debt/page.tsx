"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import {
  TrendingDown, Plus, Trash2, ChevronDown, ChevronUp,
  CreditCard, Car, GraduationCap, Home, Wallet, RotateCw,
} from "lucide-react";
import { formatCentsNumber } from "@/lib/format";

// ── types ──────────────────────────────────────────────────────────────────

interface DebtAccount {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number; // dollars (already converted)
  minimumPayment: number; // dollars
  interestRate: number;
}

// ── helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  credit_card:   { label: "Credit Card",    icon: CreditCard,     color: "bg-rose-100 text-rose-700" },
  auto_loan:     { label: "Auto Loan",      icon: Car,            color: "bg-amber-100 text-amber-700" },
  student_loan:  { label: "Student Loan",   icon: GraduationCap,  color: "bg-sky-100 text-sky-700" },
  personal_loan: { label: "Personal Loan",  icon: Wallet,         color: "bg-violet-100 text-violet-700" },
  mortgage:      { label: "Mortgage",       icon: Home,           color: "bg-emerald-100 text-emerald-700" },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? { label: type.replace(/_/g, " "), icon: Wallet, color: "bg-sky-100 text-sky-700" };
}

function calcPayoff(balanceDollars: number, annualRatePct: number, monthlyPayment: number) {
  const r = annualRatePct / 100 / 12;
  let balance = balanceDollars;
  let months = 0;
  let totalInterest = 0;
  while (balance > 0.005 && months < 600) {
    const interest = balance * r;
    totalInterest += interest;
    balance = balance + interest - monthlyPayment;
    months++;
    if (balance < 0) balance = 0;
  }
  return { months, totalInterest };
}

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── inline strategy panel ─────────────────────────────────────────────────

function StrategyPanel({ account }: { account: DebtAccount }) {
  const balanceDollars = account.currentBalance;
  const minPmt = account.minimumPayment;
  const [payment, setPayment] = useState(Math.max(minPmt * 1.5, minPmt + 10));

  const minViable = minPmt + 0.01;
  const maxSlider = Math.max(balanceDollars * 0.1, minPmt * 4);

  const { months: payoffMonths, totalInterest } = calcPayoff(balanceDollars, account.interestRate, payment);
  const { months: minMonths, totalInterest: minInterest } = calcPayoff(balanceDollars, account.interestRate, minPmt);

  const savedInterest = minInterest - totalInterest;
  const savedMonths = minMonths - payoffMonths;
  const payoffYears = Math.floor(payoffMonths / 12);
  const payoffRem = payoffMonths % 12;

  return (
    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-5 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-sky-600/70">Payoff Calculator</p>

      {/* Slider */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-sky-950">Monthly Payment</label>
          <span className="text-lg font-bold tabular-nums text-sky-950">{usd(payment)}/mo</span>
        </div>
        <input
          type="range"
          min={minViable}
          max={maxSlider}
          step={5}
          value={payment}
          onChange={(e) => setPayment(parseFloat(e.target.value))}
          className="w-full accent-sky-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-sky-600/50">
          <span>Min {usd(minViable)}</span>
          <span>{usd(maxSlider)}</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white border border-sky-100 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600/60">Payoff In</p>
          <p className="mt-1 text-lg font-bold text-sky-950">
            {payoffYears > 0 ? `${payoffYears}y ` : ""}{payoffRem}m
          </p>
          {payoffMonths >= 600
            ? <p className="text-[10px] text-rose-500">Won't pay off</p>
            : <p className="text-[10px] text-sky-500">{payoffMonths} months</p>}
        </div>
        <div className="rounded-xl bg-white border border-sky-100 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600/60">Total Interest</p>
          <p className="mt-1 text-lg font-bold text-rose-500">{usd(totalInterest)}</p>
        </div>
        <div className="rounded-xl bg-white border border-sky-100 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600/60">vs Min Pay</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">
            {savedInterest > 0 ? `−${usd(savedInterest)}` : "—"}
          </p>
          {savedMonths > 0 && (
            <p className="text-[10px] text-emerald-600">{savedMonths}mo faster</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── add debt dialog ─────────────────────────────────────────────────────────

function AddDebtDialog({
  orgId,
  onAdded,
  onClose,
}: {
  orgId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    accountName: "", accountType: "credit_card",
    currentBalance: "", minimumPayment: "", interestRate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/debt/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          accountName: form.accountName,
          accountType: form.accountType,
          currentBalance: parseFloat(form.currentBalance),
          minimumPayment: parseFloat(form.minimumPayment),
          interestRate: parseFloat(form.interestRate),
        }),
      });
      if (res.ok) { onAdded(); onClose(); }
      else { const d = await res.json(); setError(d.error ?? "Failed to add"); }
    } catch { setError("Failed to add account"); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-950 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-sky-600/70";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
          <h2 className="text-base font-bold text-sky-950">Add Debt Account</h2>
          <button onClick={onClose} className="text-sky-400 hover:text-sky-600">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Account Name</label>
            <input className={inputCls} placeholder="e.g. Chase Credit Card"
              value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>Account Type</label>
            <select className={inputCls} value={form.accountType}
              onChange={e => setForm({ ...form, accountType: e.target.value })}>
              <option value="credit_card">Credit Card</option>
              <option value="auto_loan">Auto Loan</option>
              <option value="student_loan">Student Loan</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="mortgage">Mortgage</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Balance ($)</label>
              <input className={inputCls} type="number" step="0.01" placeholder="0.00"
                value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: e.target.value })} required />
            </div>
            <div>
              <label className={labelCls}>Min Payment ($)</label>
              <input className={inputCls} type="number" step="0.01" placeholder="0.00"
                value={form.minimumPayment} onChange={e => setForm({ ...form, minimumPayment: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Interest Rate (APR %)</label>
            <input className={inputCls} type="number" step="0.01" placeholder="0.00"
              value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} required />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-sky-200 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-sky-500 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-60">
              {loading ? "Adding…" : "Add Debt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetch("/api/org/active").then(r => r.json()).then(d => setOrgId(d?.org?.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/debt/accounts?orgId=${orgId}`)
      .then(r => r.json()).then(setAccounts).catch(() => {}).finally(() => setLoading(false));
  }, [orgId]);

  const totalDebt = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalMinPayment = accounts.reduce((s, a) => s + a.minimumPayment, 0);
  const avgRate = accounts.length > 0
    ? accounts.reduce((s, a) => s + a.interestRate, 0) / accounts.length
    : 0;

  if (!orgId || loading) {
    return (
      <div className="flex items-center justify-center p-20 text-sky-600/50">
        <RotateCw className="mr-2 h-5 w-5 animate-spin" />
        Loading debts…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Debt Payoff</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            Track balances and simulate payoff strategies
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          Add Debt
        </button>
      </div>

      {/* Summary KPIs */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Debt", value: usd(totalDebt), accent: "text-rose-500" },
            { label: "Accounts",   value: String(accounts.length),   accent: "text-sky-950" },
            { label: "Avg APR",    value: `${avgRate.toFixed(2)}%`, accent: "text-amber-600" },
            { label: "Min/Month",  value: usd(totalMinPayment),     accent: "text-sky-950" },
          ].map(({ label, value, accent }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-sky-600/70">{label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <TrendingDown className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No debts tracked</h3>
            <p className="mt-1.5 text-sm text-sky-600/70">Add your first debt to start building a payoff plan.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-5 flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-bold text-white hover:bg-sky-600"
            >
              <Plus className="h-4 w-4" /> Add Debt
            </button>
          </CardContent>
        </Card>
      )}

      {/* Debt cards */}
      <div className="space-y-3">
        {accounts.map((account) => {
          const meta = getMeta(account.accountType);
          const Icon = meta.icon;
          const isOpen = expanded === account.id;
          const { months: minMonths } = calcPayoff(account.currentBalance, account.interestRate, account.minimumPayment);
          const payoffYears = Math.floor(minMonths / 12);
          const payoffRem = minMonths % 12;

          return (
            <div key={account.id} className="rounded-2xl border border-sky-100 bg-white shadow-sm">
              <div className="flex items-center gap-4 p-5">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                  <Icon className="h-5 w-5 text-sky-500" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sky-950">{account.accountName}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-sky-600/70">
                    <span>Min payment {usd(account.minimumPayment)}/mo</span>
                    <span className="text-amber-600 font-medium">{account.interestRate.toFixed(2)}% APR</span>
                    {minMonths < 600 && (
                      <span>{payoffYears > 0 ? `${payoffYears}y ` : ""}{payoffRem}m at min payment</span>
                    )}
                  </div>
                </div>

                {/* Balance + expand */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-sky-950">{usd(account.currentBalance)}</p>
                    <p className="text-[10px] text-sky-600/50">balance</p>
                  </div>
                  <button
                    onClick={() => setExpanded(isOpen ? null : account.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-500 hover:bg-sky-50"
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Inline strategy panel */}
              {isOpen && (
                <div className="border-t border-sky-50 px-5 pb-5">
                  <StrategyPanel account={account} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Strategy explainer */}
      {accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Avalanche Strategy",
              desc: "Pay minimums on all debts, then put extra money toward the highest interest rate first. Saves the most money overall.",
              badge: "Best for savings",
              badgeColor: "bg-emerald-100 text-emerald-700",
            },
            {
              title: "Snowball Strategy",
              desc: "Pay minimums on all debts, then attack the smallest balance first. Provides quick wins and psychological momentum.",
              badge: "Best for motivation",
              badgeColor: "bg-sky-100 text-sky-700",
            },
          ].map(({ title, desc, badge, badgeColor }) => (
            <div key={title} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <p className="font-semibold text-sky-950">{title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badge}</span>
              </div>
              <p className="text-sm text-sky-600/70">{desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add debt dialog */}
      {showAdd && (
        <AddDebtDialog
          orgId={orgId}
          onAdded={() => {
            fetch(`/api/debt/accounts?orgId=${orgId}`).then(r => r.json()).then(setAccounts).catch(() => {});
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
