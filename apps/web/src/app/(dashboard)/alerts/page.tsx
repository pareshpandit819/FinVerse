"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@repo/ui/card";
import {
  Bell, Plus, Trash2, RotateCw, Mail, BellRing, BellOff,
  TrendingUp, ShoppingCart, Zap, Clock, CheckCheck, AlertTriangle,
} from "lucide-react";

// ── types ───────────────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  name: string;
  ruleType: string;
  conditionType: string;
  threshold: number;
  isEnabled: boolean;
  notificationMethod: string;
}

interface AlertHistoryItem {
  id: string;
  alertRule: { name: string; ruleType: string };
  message: string;
  triggerValue: number | null;
  wasViewed: boolean;
  triggeredAt: string;
}

// ── meta helpers ─────────────────────────────────────────────────────────────

const RULE_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  budget_breach:      { label: "Budget Breach",     icon: ShoppingCart, color: "bg-rose-100 text-rose-700" },
  spending_threshold: { label: "Spending Threshold", icon: TrendingUp,   color: "bg-amber-100 text-amber-700" },
  large_transaction:  { label: "Large Transaction",  icon: Zap,          color: "bg-sky-100 text-sky-700" },
  bill_due:           { label: "Bill Due",           icon: Clock,        color: "bg-violet-100 text-violet-700" },
};

function ruleMeta(type: string) {
  return RULE_TYPE_META[type] ?? { label: type.replace(/_/g, " "), icon: Bell, color: "bg-sky-100 text-sky-700" };
}

const CONDITION_LABELS: Record<string, string> = {
  greater_than:        "greater than",
  less_than:           "less than",
  equals:              "equals",
  percentage_increase: "% increase of",
};

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── add rule dialog ──────────────────────────────────────────────────────────

function AddRuleDialog({ orgId, onAdded, onClose }: {
  orgId: string; onAdded: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "", ruleType: "spending_threshold", conditionType: "greater_than",
    threshold: "", notificationMethod: "in_app",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim())   { setError("Alert name is required"); return; }
    if (!form.threshold)     { setError("Enter a valid threshold"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId, name: form.name, ruleType: form.ruleType,
          conditionType: form.conditionType, threshold: parseFloat(form.threshold),
          notificationMethod: form.notificationMethod,
        }),
      });
      if (res.ok) { onAdded(); onClose(); }
      else { const d = await res.json(); setError(d.error ?? "Failed to create"); }
    } catch { setError("Failed to create alert"); }
    finally { setLoading(false); }
  }

  const inp = "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-950 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20";
  const lbl = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-sky-600/70";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
          <h2 className="text-base font-bold text-sky-950">New Alert Rule</h2>
          <button onClick={onClose} className="text-sky-400 hover:text-sky-600">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <label className={lbl}>Alert Name</label>
            <input className={inp} placeholder="e.g. Large transaction alert"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Alert Type</label>
              <select className={inp} value={form.ruleType}
                onChange={e => setForm({ ...form, ruleType: e.target.value })}>
                <option value="spending_threshold">Spending Threshold</option>
                <option value="budget_breach">Budget Breach</option>
                <option value="large_transaction">Large Transaction</option>
                <option value="bill_due">Bill Due</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Condition</label>
              <select className={inp} value={form.conditionType}
                onChange={e => setForm({ ...form, conditionType: e.target.value })}>
                <option value="greater_than">Greater than</option>
                <option value="less_than">Less than</option>
                <option value="equals">Equals</option>
                <option value="percentage_increase">% Increase</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Threshold ($)</label>
              <input className={inp} type="number" step="0.01" placeholder="500"
                value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} required />
            </div>
            <div>
              <label className={lbl}>Notify Via</label>
              <select className={inp} value={form.notificationMethod}
                onChange={e => setForm({ ...form, notificationMethod: e.target.value })}>
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </div>
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
              {loading ? "Creating…" : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [orgId, setOrgId]     = useState<string | null>(null);
  const [rules, setRules]     = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch("/api/org/active").then(r => r.json()).then(d => setOrgId(d?.org?.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/alerts/rules?orgId=${orgId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/alerts/history?orgId=${orgId}`).then(r => r.json()).catch(() => []),
    ]).then(([r, h]) => {
      setRules(Array.isArray(r) ? r : []);
      setHistory(Array.isArray(h) ? h : []);
    }).finally(() => setLoading(false));
  }, [orgId]);

  async function deleteRule(id: string) {
    await fetch(`/api/alerts/rules/${id}`, { method: "DELETE" }).catch(() => {});
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function markAllRead() {
    const ids = history.filter(h => !h.wasViewed).map(h => h.id);
    if (!ids.length) return;
    setMarking(true);
    await fetch(`/api/alerts/history?orgId=${orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertIds: ids }),
    }).catch(() => {});
    setHistory(prev => prev.map(h => ({ ...h, wasViewed: true })));
    setMarking(false);
  }

  const unreadCount = history.filter(h => !h.wasViewed).length;
  const activeRules = rules.filter(r => r.isEnabled).length;

  if (!orgId || loading) {
    return (
      <div className="flex items-center justify-center p-20 text-sky-600/50">
        <RotateCw className="mr-2 h-5 w-5 animate-spin" />
        Loading alerts…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Alerts</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            Monitor your finances with custom rules and instant notifications
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          New Alert Rule
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Alert Rules",    value: rules.length,   sub: `${activeRules} active`, urgent: false },
          { label: "Unread Alerts",  value: unreadCount,    sub: unreadCount > 0 ? "needs attention" : "all caught up", urgent: unreadCount > 0 },
          { label: "Total Triggers", value: history.length, sub: "last 50 events", urgent: false },
          { label: "Active Rules",   value: activeRules,    sub: `${rules.length - activeRules} paused`, urgent: false },
        ].map(({ label, value, sub, urgent }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-sky-600/70">{label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${urgent ? "text-amber-500" : "text-sky-950"}`}>
                {value}
              </p>
              <p className="mt-0.5 text-[10px] text-sky-600/50">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unread banner */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-amber-700/80">Review the history below to stay on top of your finances.</p>
            </div>
          </div>
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" />
            {marking ? "Marking…" : "Mark all read"}
          </button>
        </div>
      )}

      {/* Body: history + rules side by side */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

        {/* Alert history */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-600/70">Recent Triggers</p>

          {history.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
                  <BellOff className="h-6 w-6 text-sky-500" />
                </div>
                <p className="font-semibold text-sky-950">No alerts triggered yet</p>
                <p className="mt-1 text-sm text-sky-600/70">Your rules will fire here when conditions are met.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const meta = ruleMeta(item.alertRule.ruleType);
                const Icon = meta.icon;
                return (
                  <div key={item.id}
                    className={[
                      "rounded-2xl border p-4 transition-all",
                      item.wasViewed ? "border-sky-100 bg-white" : "border-amber-200 bg-amber-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-sky-950">{item.alertRule.name}</p>
                          {!item.wasViewed && (
                            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">New</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-sky-700/80 leading-snug">{item.message}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-sky-600/60">
                          {item.triggerValue != null && (
                            <span>Trigger: {usd(item.triggerValue / 100)}</span>
                          )}
                          <span>{relativeTime(item.triggeredAt)}</span>
                          <span>
                            {new Date(item.triggeredAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alert rules */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-600/70">Your Rules</p>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
                  <Bell className="h-6 w-6 text-sky-500" />
                </div>
                <p className="font-semibold text-sky-950">No rules configured</p>
                <p className="mt-1 text-sm text-sky-600/70">Create a rule to monitor your finances.</p>
                <button onClick={() => setShowAdd(true)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">
                  <Plus className="h-4 w-4" /> New Rule
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const meta = ruleMeta(rule.ruleType);
                const Icon = meta.icon;
                return (
                  <div key={rule.id}
                    className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:shadow-sky-100/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-sky-950 truncate">{rule.name}</p>
                          {!rule.isEnabled && (
                            <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-500">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-sky-600/70 capitalize">
                          {CONDITION_LABELS[rule.conditionType] ?? rule.conditionType} {usd(rule.threshold)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-sky-500">
                            {rule.notificationMethod === "email"  && <><Mail    className="h-3 w-3" /> Email</>}
                            {rule.notificationMethod === "in_app" && <><BellRing className="h-3 w-3" /> In-app</>}
                            {rule.notificationMethod === "both"   && <><Mail className="h-3 w-3" /><BellRing className="h-3 w-3" /> Both</>}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteRule(rule.id)}
                        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sky-400/60 hover:bg-rose-50 hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Alert types legend */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600/70">Alert Types</p>
            {Object.entries(RULE_TYPE_META).map(([, { label, icon: Icon, color }]) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-medium text-sky-950">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog */}
      {showAdd && (
        <AddRuleDialog
          orgId={orgId}
          onAdded={() => fetch(`/api/alerts/rules?orgId=${orgId}`).then(r => r.json()).then(d => setRules(Array.isArray(d) ? d : []))}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
