import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents } from "@/lib/format";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { CreditCard, Landmark, TrendingUp, Wallet, PiggyBank, Plus } from "lucide-react";
import { ACCOUNT_TYPE_LABELS } from "@repo/shared/schemas";
import type { AccountType } from "@repo/shared/schemas";

const TYPE_META: Record<string, { icon: React.ElementType; bg: string; text: string; badge: string }> = {
  checking:    { icon: Landmark,   bg: "bg-sky-100",     text: "text-sky-600",     badge: "bg-sky-50 text-sky-700 border-sky-200" },
  savings:     { icon: PiggyBank,  bg: "bg-emerald-100", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  credit_card: { icon: CreditCard, bg: "bg-rose-100",    text: "text-rose-500",    badge: "bg-rose-50 text-rose-600 border-rose-200" },
  investment:  { icon: TrendingUp, bg: "bg-violet-100",  text: "text-violet-600",  badge: "bg-violet-50 text-violet-700 border-violet-200" },
  loan:        { icon: Wallet,     bg: "bg-amber-100",   text: "text-amber-600",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  other:       { icon: Wallet,     bg: "bg-sky-100",     text: "text-sky-500",     badge: "bg-sky-50 text-sky-600 border-sky-100" },
};

const LIAB = new Set(["credit_card", "loan"]);

export default async function AccountsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: org.id },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  const canWrite = ["OWNER", "ADMIN", "MEMBER"].includes(org.role);
  const totalAssets = accounts.filter(a => !LIAB.has(a.type)).reduce((s, a) => s + a.balanceCurrent, 0n);
  const totalLiabs  = accounts.filter(a =>  LIAB.has(a.type)).reduce((s, a) => s + a.balanceCurrent, 0n);
  const netWorth    = totalAssets - totalLiabs;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Accounts</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · Net&nbsp;
            <span className={netWorth >= 0n ? "text-emerald-600" : "text-rose-500"}>
              {formatCents(netWorth)}
            </span>
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <AddTransactionDialog
              orgId={org.id}
              accounts={accounts.map(a => ({ id: a.id, name: a.name, type: a.type }))}
            />
            <AddAccountDialog orgId={org.id} />
          </div>
        )}
      </div>

      {/* Summary strip */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Total Assets</p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-600 tabular-nums">{formatCents(totalAssets)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Liabilities</p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-rose-500 tabular-nums">{formatCents(totalLiabs)}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Net Worth</p>
              <p className={`mt-1.5 text-xl font-bold tracking-tight tabular-nums ${netWorth >= 0n ? "text-sky-700" : "text-rose-500"}`}>
                {formatCents(netWorth)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account grid */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <Landmark className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No accounts yet</h3>
            <p className="mt-1.5 max-w-xs text-sm text-sky-600/70">
              Add your checking, savings, or credit accounts to start tracking.
            </p>
            {canWrite && <div className="mt-5"><AddAccountDialog orgId={org.id} /></div>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const meta = TYPE_META[account.type] ?? TYPE_META.other!;
            const Icon = meta.icon;
            const isLiab = LIAB.has(account.type);
            const label = ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? "Account";

            return (
              <div
                key={account.id}
                className="group relative rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-sky-100/50 transition-all duration-200 hover:shadow-md hover:shadow-sky-100/60 hover:border-sky-200"
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.bg}`}>
                    <Icon className={`h-5 w-5 ${meta.text}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`border text-[10px] font-semibold ${meta.badge}`}>{label}</Badge>
                    {canWrite && (
                      <DeleteAccountButton accountId={account.id} accountName={account.name} />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-sky-950 truncate">{account.name}</p>
                  <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${isLiab ? "text-rose-500" : "text-sky-950"}`}>
                    {isLiab ? "−" : ""}{formatCents(account.balanceCurrent)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-sky-500/60">{account.isoCurrencyCode}</p>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          {canWrite && (
            <AddAccountDialog orgId={org.id} trigger={
              <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 p-8 text-center transition-all duration-200 hover:border-sky-400 hover:bg-sky-50">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 transition-colors group-hover:bg-sky-200">
                  <Plus className="h-5 w-5 text-sky-500" />
                </div>
                <p className="text-sm font-semibold text-sky-500 group-hover:text-sky-700">Add Account</p>
              </button>
            } />
          )}
        </div>
      )}
    </div>
  );
}
