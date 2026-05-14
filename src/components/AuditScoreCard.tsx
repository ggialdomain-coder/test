import type { AuditResult } from "@/types/audit";

type AuditScoreCardProps = {
  score: number;
  status: AuditResult["status"];
};

export function AuditScoreCard({ score, status }: AuditScoreCardProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
        Overall Score
      </p>
      <div className="mt-6 flex justify-center">
        <div className="flex h-36 w-36 items-center justify-center rounded-full border-[12px] border-sky-200 bg-white shadow-[0_18px_40px_rgba(14,165,233,0.12)] sm:h-44 sm:w-44">
          <div className="text-center">
            <p className="text-5xl font-semibold tracking-tight text-slate-950">
              {score}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              out of 100
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <ScoreStatusBadge status={status} />
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Based on asset health, console stability, viewport load success, and
          accessibility signals.
        </p>
      </div>
    </div>
  );
}

function ScoreStatusBadge({ status }: { status: AuditResult["status"] }) {
  const styles = {
    Excellent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Good: "border-sky-200 bg-sky-50 text-sky-700",
    "Needs Improvement": "border-amber-200 bg-amber-50 text-amber-700",
    Poor: "border-rose-200 bg-rose-50 text-rose-700",
  } satisfies Record<AuditResult["status"], string>;

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${styles[status]}`}
    >
      {status}
    </span>
  );
}
