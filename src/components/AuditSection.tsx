"use client";

import { useState } from "react";

type AuditSectionProps = {
  title: string;
  summary: string;
  status: "pass" | "fail";
  items: string[];
  emptyMessage?: string;
  defaultOpen?: boolean;
};

export function AuditSection({
  title,
  summary,
  status,
  items,
  emptyMessage = "No issues found.",
  defaultOpen = false,
}: AuditSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasIssues = items.length > 0;
  const isPass = status === "pass";
  const sectionId = `${title.toLowerCase().replace(/\s+/g, "-")}-details`;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        isPass
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-amber-200 bg-amber-50/70"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        aria-expanded={isOpen}
        aria-controls={sectionId}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                isPass
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {isPass ? "Pass" : "Review"}
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-600">{summary}</p>
        </div>
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {isOpen ? "Hide" : "View"}
        </span>
      </button>

      {isOpen ? (
        <div
          id={sectionId}
          className="mt-4 space-y-3 border-t border-white/80 pt-4"
        >
          {hasIssues ? (
            items.map((item, index) => (
              <div
                key={`${title}-${index}`}
                className="whitespace-pre-line rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm leading-6 text-slate-700"
              >
                {item}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm text-slate-600">
              {emptyMessage}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
