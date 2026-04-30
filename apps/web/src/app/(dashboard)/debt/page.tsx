"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { DebtAccountsList } from "@/components/debt-accounts-list";
import { PayoffStrategyGenerator } from "@/components/payoff-strategy-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { AlertCircle, Info } from "lucide-react";

interface DebtAccount {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  minimumPayment: number;
  interestRate: number;
}

export default function DebtPage() {
  const { data: session, status } = useSession();
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DebtAccount | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Get organization ID from session context (would be set in middleware)
    // For now, we'll use a placeholder - this should come from session
    const sessionOrgId = (session as any)?.user?.organizationId;
    setOrgId(sessionOrgId);
  }, [session]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  if (!orgId) {
    return <div>Loading organization...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Debt Payoff Assistant</h1>
        <p className="text-muted-foreground mt-2">
          Manage your debts and create customized payoff strategies
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Smart Payoff Strategies</AlertTitle>
        <AlertDescription>
          Compare debt payoff strategies like avalanche (highest interest first) and snowball (smallest balance first) to find the best approach for your situation.
        </AlertDescription>
      </Alert>

      <DebtAccountsList
        organizationId={orgId}
        onAccountAdded={() => {
          // Refresh accounts if needed
        }}
      />

      {debtAccounts.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Create Payoff Strategy</h2>
            <p className="text-muted-foreground mb-4">
              Select a debt account to generate a customized payoff strategy
            </p>
          </div>

          {selectedAccount ? (
            <PayoffStrategyGenerator
              organizationId={orgId}
              debtAccount={selectedAccount}
              onStrategyGenerated={() => {
                // Refresh strategies
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Choose a Debt Account</CardTitle>
                <CardDescription>
                  Select one of your debt accounts to create a payoff strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {debtAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition"
                  >
                    <p className="font-medium">{account.accountName}</p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ${(account.currentBalance / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} • Rate: {account.interestRate.toFixed(2)}%
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Avalanche Strategy</h3>
            <p className="text-sm text-muted-foreground">
              Pay off debts starting with the highest interest rate. This saves the most money on interest overall.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Snowball Strategy</h3>
            <p className="text-sm text-muted-foreground">
              Pay off debts starting with the smallest balance. This provides quick wins and psychological motivation.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Custom Payment Amount</h3>
            <p className="text-sm text-muted-foreground">
              Adjust your monthly payment to see how it affects your payoff timeline and total interest paid.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
