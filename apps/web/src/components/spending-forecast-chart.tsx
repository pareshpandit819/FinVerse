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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";

interface SpendingForecast {
  id: string;
  forecastType: string;
  category: string | null;
  predictedAmount: number;
  confidenceScore: number;
  dataPoints: number;
  forecast: Array<{
    date: string;
    amount: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  methodology: string;
}

export function SpendingForecastChart({
  organizationId,
}: {
  organizationId: string;
}) {
  const [forecasts, setForecasts] = useState<SpendingForecast[]>([]);
  const [selectedForecast, setSelectedForecast] = useState<SpendingForecast | null>(null);
  const [forecastType, setForecastType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchForecasts();
  }, []);

  async function fetchForecasts() {
    try {
      const response = await fetch(`/api/forecast/spending?orgId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setForecasts(data);
        if (data.length > 0) {
          setSelectedForecast(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch forecasts:", error);
    }
  }

  async function generateForecast() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/forecast/spending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          forecastType,
          daysLookback: 90,
        }),
      });

      if (response.ok) {
        await fetchForecasts();
      }
    } catch (error) {
      console.error("Failed to generate forecast:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const chartData = selectedForecast?.forecast.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: (point.amount / 100).toFixed(2),
    lower: (point.lower_bound / 100).toFixed(2),
    upper: (point.upper_bound / 100).toFixed(2),
  })) || [];

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-orange-600";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return "High";
    if (score >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Spending Forecast
              </CardTitle>
              <CardDescription>
                AI-powered predictions based on your spending patterns
              </CardDescription>
            </div>
            <Button
              onClick={generateForecast}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <Select value={forecastType} onValueChange={(value) => setForecastType(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedForecast && chartData.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Predicted Total</p>
                  <p className="text-2xl font-bold">
                    ${(selectedForecast.predictedAmount / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                  <p className={`text-2xl font-bold ${getConfidenceColor(selectedForecast.confidenceScore)}`}>
                    {getConfidenceLabel(selectedForecast.confidenceScore)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedForecast.confidenceScore * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Data Points</p>
                  <p className="text-2xl font-bold">{selectedForecast.dataPoints}</p>
                  <p className="text-xs text-muted-foreground">transactions</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-white dark:bg-slate-950">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `$${value}`}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      name="Predicted"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="upper"
                      stroke="#ef4444"
                      name="Upper Bound"
                      dot={false}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />
                    <Line
                      type="monotone"
                      dataKey="lower"
                      stroke="#10b981"
                      name="Lower Bound"
                      dot={false}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Using {selectedForecast.methodology} methodology</p>
                <p className="text-xs">Updated at {new Date().toLocaleString()}</p>
              </div>
            </div>
          )}

          {(!selectedForecast || chartData.length === 0) && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No forecast data available</p>
              <Button onClick={generateForecast} disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate First Forecast"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
