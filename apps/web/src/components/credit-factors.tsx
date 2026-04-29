"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Progress } from "@repo/ui/progress";

interface CreditScoreData {
  paymentHistory: number;
  creditUtilization: number;
  creditAge: number;
  derogatoryMarks: number;
  hardInquiries: number;
  totalAccounts: number;
}

interface CreditFactorsProps {
  data: CreditScoreData;
}

const FACTOR_WEIGHTS = {
  paymentHistory: 35,
  creditUtilization: 30,
  creditAge: 15,
  derogatoryMarks: 10,
  hardInquiries: 5,
  totalAccounts: 5,
};

export function CreditFactors({ data }: CreditFactorsProps) {
  const factors = [
    { key: "paymentHistory", label: "Payment History", icon: "📋", weight: 35 },
    { key: "creditUtilization", label: "Credit Utilization", icon: "💳", weight: 30 },
    { key: "creditAge", label: "Credit Age", icon: "📅", weight: 15 },
    { key: "derogatoryMarks", label: "Derogatory Marks", icon: "⚠️", weight: 10 },
    { key: "hardInquiries", label: "Hard Inquiries", icon: "🔍", weight: 5 },
    { key: "totalAccounts", label: "Total Accounts", icon: "🏦", weight: 5 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Score Factors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {factors.map((factor) => {
          const value = data[factor.key as keyof CreditScoreData] || 0;
          const percentage = Math.min(value, 100);
          
          return (
            <div key={factor.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{factor.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-sky-950">{factor.label}</p>
                    <p className="text-xs text-sky-600/60">{factor.weight}% weight</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-sky-700">{value}%</p>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
