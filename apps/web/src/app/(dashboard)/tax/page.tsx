"use client";

import { useEffect, useState, useMemo } from "react";
import { Calculator, RotateCw, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";

// ── 2024 Federal tax data ──────────────────────────────────────────────────

const STANDARD_DEDUCTIONS = {
  single: 14_600,
  married_jointly: 29_200,
  head_of_household: 21_900,
};

const FEDERAL_BRACKETS: Record<string, { rate: number; max: number }[]> = {
  single: [
    { rate: 0.10, max: 11_600 },
    { rate: 0.12, max: 47_150 },
    { rate: 0.22, max: 100_525 },
    { rate: 0.24, max: 191_950 },
    { rate: 0.32, max: 243_725 },
    { rate: 0.35, max: 609_350 },
    { rate: 0.37, max: Infinity },
  ],
  married_jointly: [
    { rate: 0.10, max: 23_200 },
    { rate: 0.12, max: 94_300 },
    { rate: 0.22, max: 201_050 },
    { rate: 0.24, max: 383_900 },
    { rate: 0.32, max: 487_450 },
    { rate: 0.35, max: 731_200 },
    { rate: 0.37, max: Infinity },
  ],
  head_of_household: [
    { rate: 0.10, max: 16_550 },
    { rate: 0.12, max: 63_100 },
    { rate: 0.22, max: 100_500 },
    { rate: 0.24, max: 191_950 },
    { rate: 0.32, max: 243_700 },
    { rate: 0.35, max: 609_350 },
    { rate: 0.37, max: Infinity },
  ],
};

const LTCG_BRACKETS: Record<string, { rate: number; max: number }[]> = {
  single: [
    { rate: 0.00, max: 47_025 },
    { rate: 0.15, max: 518_900 },
    { rate: 0.20, max: Infinity },
  ],
  married_jointly: [
    { rate: 0.00, max: 94_050 },
    { rate: 0.15, max: 583_750 },
    { rate: 0.20, max: Infinity },
  ],
  head_of_household: [
    { rate: 0.00, max: 63_000 },
    { rate: 0.15, max: 551_350 },
    { rate: 0.20, max: Infinity },
  ],
};

// Flat-rate state approximations (marginal rate on middle income)
const STATE_RATES: { code: string; name: string; rate: number }[] = [
  { code: "AK", name: "Alaska (No Income Tax)", rate: 0 },
  { code: "AZ", name: "Arizona", rate: 0.025 },
  { code: "CA", name: "California", rate: 0.093 },
  { code: "CO", name: "Colorado", rate: 0.044 },
  { code: "FL", name: "Florida (No Income Tax)", rate: 0 },
  { code: "GA", name: "Georgia", rate: 0.055 },
  { code: "IL", name: "Illinois", rate: 0.0495 },
  { code: "MA", name: "Massachusetts", rate: 0.05 },
  { code: "MD", name: "Maryland", rate: 0.0575 },
  { code: "MI", name: "Michigan", rate: 0.0425 },
  { code: "MN", name: "Minnesota", rate: 0.0985 },
  { code: "NC", name: "North Carolina", rate: 0.0525 },
  { code: "NJ", name: "New Jersey", rate: 0.0637 },
  { code: "NV", name: "Nevada (No Income Tax)", rate: 0 },
  { code: "NY", name: "New York", rate: 0.0685 },
  { code: "OH", name: "Ohio", rate: 0.04 },
  { code: "OR", name: "Oregon", rate: 0.099 },
  { code: "PA", name: "Pennsylvania", rate: 0.0307 },
  { code: "TX", name: "Texas (No Income Tax)", rate: 0 },
  { code: "VA", name: "Virginia", rate: 0.0575 },
  { code: "WA", name: "Washington (No Income Tax)", rate: 0 },
  { code: "WI", name: "Wisconsin", rate: 0.0765 },
];

// ── Tax calculation helpers ────────────────────────────────────────────────

function bracketTax(income: number, brackets: { rate: number; max: number }[]): number {
  let tax = 0;
  let prev = 0;
  for (const { rate, max } of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, max) - prev) * rate;
    prev = max;
  }
  return tax;
}

function estimateTax(
  incomeDollars: number,
  gainsDollars: number,
  gainType: "short" | "long",
  filingStatus: keyof typeof STANDARD_DEDUCTIONS,
  stateRate: number
) {
  const deduction = STANDARD_DEDUCTIONS[filingStatus];
  // Short-term gains taxed as ordinary income; long-term gains taxed separately
  const ordinaryGross = incomeDollars + (gainType === "short" ? Math.max(0, gainsDollars) : 0);
  // Capital losses (up to $3k) can offset ordinary income
  const lossOffset = gainType === "short" && gainsDollars < 0 ? Math.min(3_000, Math.abs(gainsDollars)) : 0;
  const taxableOrdinary = Math.max(0, ordinaryGross - deduction - lossOffset);

  const federalIncomeTax = bracketTax(taxableOrdinary, FEDERAL_BRACKETS[filingStatus]!);

  // Long-term capital gains stacked on top of ordinary income
  let federalCapGainsTax = 0;
  if (gainType === "long" && gainsDollars > 0) {
    const taxWithGains = bracketTax(taxableOrdinary + gainsDollars, LTCG_BRACKETS[filingStatus]!);
    const taxWithout = bracketTax(taxableOrdinary, LTCG_BRACKETS[filingStatus]!);
    federalCapGainsTax = taxWithGains - taxWithout;
  }

  const stateTax = Math.max(0, taxableOrdinary) * stateRate;
  const totalTax = federalIncomeTax + federalCapGainsTax + stateTax;
  const grossIncome = ordinaryGross + (gainType === "long" ? Math.max(0, gainsDollars) : 0);
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  return {
    taxableOrdinary,
    deduction,
    federalIncomeTax,
    federalCapGainsTax,
    stateTax,
    totalTax,
    effectiveRate,
    quarterlyPayment: totalTax / 4,
    marginalBracket: getMarginalRate(taxableOrdinary, FEDERAL_BRACKETS[filingStatus]!),
  };
}

function getMarginalRate(income: number, brackets: { rate: number; max: number }[]): number {
  let prev = 0;
  for (const { rate, max } of brackets) {
    if (income <= max) return rate;
    prev = max;
  }
  return brackets.at(-1)!.rate;
}

function usd(dollars: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(dollars);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// ── Page ──────────────────────────────────────────────────────────────────

interface ApiData {
  taxYear: number;
  estimatedIncomeCents: number;
  incomeTransactionCount: number;
  unrealizedGainsCents: number;
  holdingsWithBasis: number;
  totalHoldings: number;
}

type FilingStatus = keyof typeof STANDARD_DEDUCTIONS;

export default function TaxPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [stateCode, setStateCode] = useState("CA");
  const [incomeInput, setIncomeInput] = useState("");
  const [gainsInput, setGainsInput] = useState("");
  const [gainType, setGainType] = useState<"long" | "short">("long");

  useEffect(() => {
    fetch("/api/org/active")
      .then((r) => r.json())
      .then((json) => setOrgId(json?.org?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/tax/estimate?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d: ApiData) => {
        setApiData(d);
        setIncomeInput(String(Math.round(d.estimatedIncomeCents / 100)));
        setGainsInput(String(Math.round(Math.max(0, d.unrealizedGainsCents) / 100)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const stateRate = STATE_RATES.find((s) => s.code === stateCode)?.rate ?? 0;

  const result = useMemo(() => {
    const income = Math.max(0, parseFloat(incomeInput) || 0);
    const gains = parseFloat(gainsInput) || 0;
    return estimateTax(income, gains, gainType, filingStatus, stateRate);
  }, [incomeInput, gainsInput, gainType, filingStatus, stateRate]);

  const inputClass =
    "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-950 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-sky-600/70";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sky-950">Tax Estimator</h1>
        <p className="mt-1 text-sm font-medium text-sky-600/70">
          2024 federal + state estimate · Adjust any field and results update instantly
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20 text-sky-600/50">
          <RotateCw className="mr-2 h-5 w-5 animate-spin" />
          Loading your financial data…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* ── Inputs ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-sky-950">
                  <Calculator className="h-4 w-4 text-sky-500" />
                  Your Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filing status */}
                <div>
                  <label className={labelClass}>Filing Status</label>
                  <select
                    value={filingStatus}
                    onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                    className={inputClass}
                  >
                    <option value="single">Single</option>
                    <option value="married_jointly">Married Filing Jointly</option>
                    <option value="head_of_household">Head of Household</option>
                  </select>
                </div>

                {/* State */}
                <div>
                  <label className={labelClass}>State</label>
                  <select
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    className={inputClass}
                  >
                    {STATE_RATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Income */}
                <div>
                  <label className={labelClass}>Annual Income ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={incomeInput}
                    onChange={(e) => setIncomeInput(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                  {apiData && apiData.incomeTransactionCount > 0 && (
                    <p className="mt-1 text-[11px] text-sky-600/60">
                      Pre-filled from {apiData.incomeTransactionCount} income transactions in {apiData.taxYear}
                    </p>
                  )}
                </div>

                {/* Capital gains */}
                <div>
                  <label className={labelClass}>Capital Gains / Losses ($)</label>
                  <input
                    type="number"
                    value={gainsInput}
                    onChange={(e) => setGainsInput(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                  {apiData && apiData.holdingsWithBasis > 0 && (
                    <p className="mt-1 text-[11px] text-sky-600/60">
                      Pre-filled from unrealized gains across {apiData.holdingsWithBasis} holding
                      {apiData.holdingsWithBasis !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Gain type toggle */}
                <div>
                  <label className={labelClass}>Gain Type</label>
                  <div className="flex overflow-hidden rounded-xl border border-sky-200">
                    {(["long", "short"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setGainType(t)}
                        className={[
                          "flex-1 py-2 text-sm font-medium transition-colors",
                          gainType === t
                            ? "bg-sky-500 text-white"
                            : "bg-white text-sky-600/70 hover:bg-sky-50",
                        ].join(" ")}
                      >
                        {t === "long" ? "Long-term (≥1 yr)" : "Short-term (<1 yr)"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-sky-600/60">
                    {gainType === "long"
                      ? "Long-term gains are taxed at preferential 0–20% rates"
                      : "Short-term gains are taxed as ordinary income"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This is a rough estimate using simplified 2024 tax rules. It does not account for
                deductions, credits, AMT, NIIT, or state-specific rules. Consult a tax professional
                for accurate advice.
              </span>
            </div>
          </div>

          {/* ── Results ── */}
          <div className="space-y-4">
            {/* Total tax — hero card */}
            <div className="rounded-2xl bg-sky-950 p-6 text-white">
              <p className="text-sm font-medium text-sky-300/80">Estimated Total Tax</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">{usd(result.totalTax)}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Badge className="bg-sky-700 text-sky-100 hover:bg-sky-700">
                  Effective rate: {pct(result.effectiveRate)}
                </Badge>
                <Badge className="bg-sky-700 text-sky-100 hover:bg-sky-700">
                  Marginal: {pct(result.marginalBracket)}
                </Badge>
              </div>
            </div>

            {/* Breakdown */}
            <Card>
              <CardContent className="divide-y divide-sky-50 p-0">
                {[
                  {
                    label: "Gross Income",
                    value: usd(parseFloat(incomeInput) || 0),
                    sub: null,
                    muted: true,
                  },
                  {
                    label: "Standard Deduction",
                    value: `− ${usd(result.deduction)}`,
                    sub: `${filingStatus.replace("_", " ")} filer`,
                    muted: true,
                  },
                  {
                    label: "Taxable Income",
                    value: usd(result.taxableOrdinary),
                    sub: null,
                    muted: false,
                  },
                  {
                    label: "Federal Income Tax",
                    value: usd(result.federalIncomeTax),
                    sub: `${pct(result.marginalBracket)} marginal bracket`,
                    muted: false,
                  },
                  ...(result.federalCapGainsTax > 0
                    ? [
                        {
                          label: `Federal Cap. Gains Tax`,
                          value: usd(result.federalCapGainsTax),
                          sub: `${gainType === "long" ? "Long" : "Short"}-term rate`,
                          muted: false,
                        },
                      ]
                    : []),
                  {
                    label: `State Tax (${stateCode})`,
                    value: usd(result.stateTax),
                    sub: stateRate > 0 ? `${pct(stateRate)} flat approx.` : "No state income tax",
                    muted: false,
                  },
                ].map(({ label, value, sub, muted }) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className={`text-sm font-medium ${muted ? "text-sky-600/60" : "text-sky-950"}`}>
                        {label}
                      </p>
                      {sub && <p className="text-[11px] text-sky-500/60">{sub}</p>}
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${muted ? "text-sky-600/60" : "text-sky-950"}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quarterly payment suggestion */}
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-600/70">
                  Quarterly Estimated Payment
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-sky-950">
                  {usd(result.quarterlyPayment)}
                </p>
                <p className="mt-1 text-xs text-sky-600/60">
                  Due ~Apr 15, Jun 15, Sep 15, Jan 15 if you pay estimated taxes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
