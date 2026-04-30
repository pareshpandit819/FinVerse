import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { TrendingDown, Plus, Trash2 } from "lucide-react";

interface DebtAccount {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  minimumPayment: number;
  interestRate: number;
}

export function DebtAccountsList({
  organizationId,
  onAccountAdded,
}: {
  organizationId: string;
  onAccountAdded: () => void;
}) {
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    accountName: "",
    accountType: "credit_card",
    currentBalance: "",
    minimumPayment: "",
    interestRate: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const response = await fetch(`/api/debt/accounts?orgId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error("Failed to fetch debt accounts:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validation
    if (!formData.accountName.trim()) {
      setError("Account name is required");
      setIsLoading(false);
      return;
    }
    if (!formData.currentBalance || parseFloat(formData.currentBalance) < 0) {
      setError("Current balance must be a positive number");
      setIsLoading(false);
      return;
    }
    if (!formData.minimumPayment || parseFloat(formData.minimumPayment) <= 0) {
      setError("Minimum payment must be greater than 0");
      setIsLoading(false);
      return;
    }
    if (!formData.interestRate || parseFloat(formData.interestRate) < 0 || parseFloat(formData.interestRate) > 100) {
      setError("Interest rate must be between 0 and 100");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/debt/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          accountName: formData.accountName,
          accountType: formData.accountType,
          currentBalance: parseFloat(formData.currentBalance),
          minimumPayment: parseFloat(formData.minimumPayment),
          interestRate: parseFloat(formData.interestRate),
        }),
      });

      if (response.ok) {
        setIsOpen(false);
        setFormData({
          accountName: "",
          accountType: "credit_card",
          currentBalance: "",
          minimumPayment: "",
          interestRate: "",
        });
        await fetchAccounts();
        onAccountAdded();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add account");
      }
    } catch (err) {
      console.error("Failed to add debt account:", err);
      setError("Failed to add account");
    } finally {
      setIsLoading(false);
    }
  }

  const totalDebt = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const avgInterestRate = accounts.length > 0
    ? accounts.reduce((sum, acc) => sum + acc.interestRate, 0) / accounts.length
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Debt Accounts
              </CardTitle>
              <CardDescription>
                Manage your debts and create payoff strategies
              </CardDescription>
            </div>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Debt
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No debt accounts yet</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Debt</p>
                  <p className="text-2xl font-bold">${(totalDebt / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Interest Rate</p>
                  <p className="text-2xl font-bold">{avgInterestRate.toFixed(2)}%</p>
                </div>
              </div>

              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{account.accountName}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.accountType.replace(/_/g, " ")} • {account.interestRate.toFixed(2)}% APR
                      </p>
                      <p className="text-sm">
                        Balance: ${(account.currentBalance / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Debt Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="e.g., Chase Credit Card"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="accountType">Account Type</Label>
              <Select value={formData.accountType} onValueChange={(value) => setFormData({ ...formData, accountType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="personal_loan">Personal Loan</SelectItem>
                  <SelectItem value="auto_loan">Auto Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="student_loan">Student Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currentBalance">Current Balance ($)</Label>
              <Input
                id="currentBalance"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.currentBalance}
                onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="minimumPayment">Minimum Monthly Payment ($)</Label>
              <Input
                id="minimumPayment"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.minimumPayment}
                onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
              <Input
                id="interestRate"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              />
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
                {isLoading ? "Adding..." : "Add Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
