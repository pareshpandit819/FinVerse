import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Zap, Calendar, DollarSign } from "lucide-react";

interface DebtAccount {
  id: string;
  accountName: string;
  currentBalance: number;
  interestRate: number;
}

interface PayoffStrategy {
  id: string;
  strategyType: string;
  monthlyPaymentAmount: number;
  projectedPayoffMonths: number;
  totalInterestPaid: number;
  payoffDate: string;
  schedule: Array<{
    month: number;
    balance: number;
    interest: number;
    principal: number;
    payment: number;
  }>;
}

export function PayoffStrategyGenerator({
  organizationId,
  debtAccount,
  onStrategyGenerated,
}: {
  organizationId: string;
  debtAccount: DebtAccount;
  onStrategyGenerated: () => void;
}) {
  const [strategy, setStrategy] = useState<PayoffStrategy | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState(
    ((debtAccount.currentBalance / 100) / 60).toFixed(2) // Default: pay off in 5 years
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!monthlyPayment || parseFloat(monthlyPayment) <= 0) {
      setError("Monthly payment must be greater than 0");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/debt/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          debtAccountId: debtAccount.id,
          monthlyPaymentAmount: parseFloat(monthlyPayment),
        }),
      });

      if (response.ok) {
        const strategyData = await response.json();
        setStrategy(strategyData);
        onStrategyGenerated();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to generate strategy");
      }
    } catch (err) {
      console.error("Failed to generate strategy:", err);
      setError("Failed to generate strategy");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Payoff Strategy: {debtAccount.accountName}
          </CardTitle>
          <CardDescription>
            Create a custom payoff plan for this debt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strategy ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Monthly Payment</p>
                  <p className="text-2xl font-bold">
                    ${strategy.monthlyPaymentAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Payoff Time</p>
                  <p className="text-2xl font-bold">{strategy.projectedPayoffMonths} months</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(strategy.projectedPayoffMonths / 12)} years
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Interest</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${strategy.totalInterestPaid.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Payoff Schedule (First 12 Months)</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {strategy.schedule.slice(0, 12).map((month) => (
                    <div
                      key={month.month}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <span>Month {month.month}</span>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">
                          Int: ${(month.interest / 100).toFixed(2)}
                        </span>
                        <span className="font-medium">
                          Bal: ${(month.balance / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full">Activate This Plan</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setIsOpen(true)} className="w-full">
                Generate Payoff Strategy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payoff Strategy</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="payment">Monthly Payment Amount ($)</Label>
              <Input
                id="payment"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be more than ${((debtAccount.currentBalance / 100) * 0.02).toFixed(2)} to make progress
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate Strategy"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
