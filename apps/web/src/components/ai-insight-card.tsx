type AIInsightCardProps = {
  title: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high";
};

export function AIInsightCard({
  title,
  description,
  confidence,
  severity,
}: AIInsightCardProps) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">AI Financial Insight</p>
        <span className="rounded-full border px-2 py-1 text-xs capitalize">
          {severity}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-gray-900">{title}</h3>

      <p className="mt-2 text-sm text-gray-600">{description}</p>

      <p className="mt-4 text-xs text-gray-500">
        Confidence: {Math.round(confidence * 100)}% · This is not financial advice.
      </p>
    </section>
  );
}
