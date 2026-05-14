"use client";

import type { AuditResult } from "@/types/audit";

type ReportHistoryProps = {
  history: AuditResult[];
  onSelect: (report: AuditResult) => void;
  onClear: () => void;
};

export function ReportHistory({
  history,
  onSelect,
  onClear,
}: ReportHistoryProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            Recent Reports
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Local Audit History
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Saved in your browser after each successful audit. Click any report
            to reload it instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={history.length === 0}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear History
        </button>
      </div>

      <div className="mt-6 space-y-3" aria-live="polite">
        {history.length > 0 ? (
          history.map((report) => (
            <button
              key={`${report.url}-${report.auditedAt}`}
              type="button"
              onClick={() => onSelect(report)}
              className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              aria-label={`Load audit report for ${report.url}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-950">
                    {report.url}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatAuditDate(report.auditedAt)}
                  </p>
                </div>
                <span className={getHistoryStatusClassName(report.status)}>
                  {report.status}
                </span>
              </div>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1">
                  Score: {report.score}/100
                </span>
                <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1">
                  View Report
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
            No reports saved yet. Run an audit to build local history.
          </div>
        )}
      </div>
    </div>
  );
}

function formatAuditDate(value: string) {
  return new Date(value).toLocaleString();
}

function getHistoryStatusClassName(status: AuditResult["status"]) {
  const styles = {
    Excellent:
      "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700",
    Good: "rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700",
    "Needs Improvement":
      "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700",
    Poor: "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700",
  } satisfies Record<AuditResult["status"], string>;

  return styles[status];
}
