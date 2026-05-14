type SummaryCardItem = {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
};

type AuditSummaryCardsProps = {
  items: SummaryCardItem[];
};

export function AuditSummaryCards({ items }: AuditSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <SummaryCard
          key={item.label}
          label={item.label}
          value={item.value}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: SummaryCardItem) {
  const isPositive = tone === "positive";
  const isNeutral = tone === "neutral";

  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm ${
        isNeutral
          ? "border-slate-200 bg-slate-50/90"
          : isPositive
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-amber-200 bg-amber-50/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-sm font-medium ${
            isNeutral
              ? "text-slate-700"
              : isPositive
                ? "text-emerald-800"
                : "text-amber-800"
          }`}
        >
          {label}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            isNeutral
              ? "bg-slate-200 text-slate-700"
              : isPositive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isNeutral ? "Info" : isPositive ? "Pass" : "Review"}
        </span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-6 text-slate-950">
        {value}
      </p>
    </div>
  );
}
