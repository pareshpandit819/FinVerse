"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { formatCents, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CreditAccount {
  id: string;
  accountName: string;
  accountType: string;
  creditor: string;
  balance: bigint;
  creditLimit: bigint | null;
  accountStatus: string;
  paymentStatus: string;
  monthlyPayment: bigint | null;
  openDate: Date;
  lastPaymentDate: Date | null;
  nextPaymentDue: Date | null;
}

interface CreditAccountsProps {
  accounts: CreditAccount[];
}

const ACCOUNT_TYPE_COLORS: Record<string, { badge: string; text: string }> = {
  credit_card: { badge: "bg-rose-50 text-rose-700 border-rose-200", text: "text-rose-600" },
  loan: { badge: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600" },
  mortgage: { badge: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600" },
  auto_loan: { badge: "bg-violet-50 text-violet-700 border-violet-200", text: "text-violet-600" },
  student_loan: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "text-indigo-600" },
  line_of_credit: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600" },
  other: { badge: "bg-sky-50 text-sky-700 border-sky-200", text: "text-sky-600" },
};

const STATUS_COLORS: Record<string, string> = {
  current: "bg-emerald-100 text-emerald-800",
  late: "bg-rose-100 text-rose-800",
  "30_days_late": "bg-orange-100 text-orange-800",
  "60_days_late": "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-800",
  open: "bg-blue-100 text-blue-800",
};

export function CreditAccounts({ accounts }: CreditAccountsProps) {
  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
            <span className="text-2xl">💳</span>
          </div>
          <h3 className="font-semibold text-sky-950">No credit accounts</h3>
          <p className="mt-1.5 max-w-xs text-sm text-sky-600/70">
            You don't have any credit accounts tracked yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Accounts & Loans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accounts.map((account) => {
            const colors = ACCOUNT_TYPE_COLORS[account.accountType] || ACCOUNT_TYPE_COLORS.other;
            const statusColor = STATUS_COLORS[account.paymentStatus] || STATUS_COLORS.open;
            const utilizationPercent = account.creditLimit
              ? Math.round((Number(account.balance) / Number(account.creditLimit)) * 100)
              : null;

            return (
              <div
                key={account.id}
                className="space-y-3 rounded-lg border border-sky-200 p-4 hover:bg-sky-50/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sky-950">{account.accountName}</h4>
                      <Badge variant="outline" className={colors.badge}>
                        {account.accountType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-sky-600">{account.creditor}</p>
                  </div>
                  <Badge className={statusColor}>
                    {account.paymentStatus.replace(/_/g, " ")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-sky-600/60">Current Balance</p>
                    <p className="mt-1 text-sm font-bold text-sky-950">
                      {formatCents(account.balance)}
                    </p>
                  </div>

                  {account.creditLimit && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-sky-600/60">Credit Limit</p>
                      <p className="mt-1 text-sm font-bold text-sky-950">
                        {formatCents(account.creditLimit)}
                      </p>
                    </div>
                  )}

                  {utilizationPercent !== null && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-sky-600/60">Utilization</p>
                      <p className={`mt-1 text-sm font-bold ${utilizationPercent > 70 ? "text-rose-600" : "text-emerald-600"}`}>
                        {utilizationPercent}%
                      </p>
                    </div>
                  )}

                  {account.monthlyPayment && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-sky-600/60">Monthly Payment</p>
                      <p className="mt-1 text-sm font-bold text-sky-950">
                        {formatCents(account.monthlyPayment)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 pt-2 border-t border-sky-200/50 text-xs">
                  <div>
                    <span className="text-sky-600/60">Account Status:</span>
                    <span className="ml-1 font-semibold text-sky-950">
                      {account.accountStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-sky-600/60">Opened:</span>
                    <span className="ml-1 font-semibold text-sky-950">
                      {formatDate(account.openDate)}
                    </span>
                  </div>
                  {account.lastPaymentDate && (
                    <div>
                      <span className="text-sky-600/60">Last Payment:</span>
                      <span className="ml-1 font-semibold text-sky-950">
                        {formatDate(account.lastPaymentDate)}
                      </span>
                    </div>
                  )}
                  {account.nextPaymentDue && (
                    <div>
                      <span className="text-sky-600/60">Next Due:</span>
                      <span className="ml-1 font-semibold text-sky-950">
                        {formatDate(account.nextPaymentDue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
