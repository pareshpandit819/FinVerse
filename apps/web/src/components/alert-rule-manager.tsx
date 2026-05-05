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
import { Bell, Plus, Trash2 } from "lucide-react";

interface AlertRule {
  id: string;
  name: string;
  ruleType: string;
  conditionType: string;
  threshold: number;
  isEnabled: boolean;
  notificationMethod: string;
}

export function AlertRuleManager({
  organizationId,
}: {
  organizationId: string;
}) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    ruleType: "spending_threshold",
    conditionType: "greater_than",
    threshold: "",
    notificationMethod: "email",
  });

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      const response = await fetch(`/api/alerts/rules?orgId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (err) {
      console.error("Failed to fetch alert rules:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Alert name is required");
      setIsLoading(false);
      return;
    }
    if (!formData.threshold || parseFloat(formData.threshold) < 0) {
      setError("Threshold must be a positive number");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: formData.name,
          ruleType: formData.ruleType,
          conditionType: formData.conditionType,
          threshold: parseFloat(formData.threshold),
          notificationMethod: formData.notificationMethod,
        }),
      });

      if (response.ok) {
        setIsOpen(false);
        setFormData({
          name: "",
          ruleType: "spending_threshold",
          conditionType: "greater_than",
          threshold: "",
          notificationMethod: "email",
        });
        await fetchRules();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create alert");
      }
    } catch (err) {
      console.error("Failed to create alert rule:", err);
      setError("Failed to create alert");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteRule(ruleId: string) {
    try {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchRules();
      }
    } catch (err) {
      console.error("Failed to delete alert rule:", err);
    }
  }

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_breach: "Budget Breach",
      spending_threshold: "Spending Threshold",
      large_transaction: "Large Transaction",
      bill_due: "Bill Due",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alert Rules
              </CardTitle>
              <CardDescription>
                Create custom alerts to monitor your finances
              </CardDescription>
            </div>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Alert
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No alerts configured yet</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      {!rule.isEnabled && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getRuleTypeLabel(rule.ruleType)} • {rule.conditionType.replace(/_/g, " ")} ${rule.threshold.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Notification: {rule.notificationMethod}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Alert Name</Label>
              <Input
                id="name"
                placeholder="e.g., High spending alert"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="ruleType">Alert Type</Label>
              <Select value={formData.ruleType} onValueChange={(value) => setFormData({ ...formData, ruleType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spending_threshold">Spending Threshold</SelectItem>
                  <SelectItem value="budget_breach">Budget Breach</SelectItem>
                  <SelectItem value="large_transaction">Large Transaction</SelectItem>
                  <SelectItem value="bill_due">Bill Due</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="conditionType">Condition</Label>
              <Select value={formData.conditionType} onValueChange={(value) => setFormData({ ...formData, conditionType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="greater_than">Greater than</SelectItem>
                  <SelectItem value="less_than">Less than</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="percentage_increase">% Increase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="threshold">Threshold</Label>
              <Input
                id="threshold"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Amount or percentage to trigger the alert</p>
            </div>

            <div>
              <Label htmlFor="method">Notification Method</Label>
              <Select value={formData.notificationMethod} onValueChange={(value) => setFormData({ ...formData, notificationMethod: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_app">In-App</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
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
                {isLoading ? "Creating..." : "Create Alert"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
