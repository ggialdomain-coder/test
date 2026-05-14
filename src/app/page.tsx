"use client";

import { FormEvent, useState } from "react";

import { AuditResult } from "@/components/AuditResult";
import { ReportHistory } from "@/components/ReportHistory";
import { UrlAuditForm } from "@/components/UrlAuditForm";
import { getAuditApiUrl } from "@/lib/getAuditApiUrl";
import type {
  AuditErrorDebug,
  AuditResult as AuditResultType,
} from "@/types/audit";

const HISTORY_STORAGE_KEY = "frontend-qa-audit-history";
const MAX_HISTORY_ITEMS = 10;

function getInvalidUrlMessage() {
  return "Enter a valid website URL that starts with http:// or https://.";
}

function isValidWebsiteUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Home() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const auditApiUrl = getAuditApiUrl();
  const [url, setUrl] = useState("https://example.com");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDebug, setErrorDebug] = useState<AuditErrorDebug | null>(null);
  const [result, setResult] = useState<AuditResultType | null>(null);
  const [history, setHistory] = useState<AuditResultType[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);

      if (!storedHistory) {
        return [];
      }

      const parsedHistory: unknown = JSON.parse(storedHistory);

      return Array.isArray(parsedHistory)
        ? (parsedHistory as AuditResultType[])
        : [];
    } catch {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      return [];
    }
  });

  const saveHistory = (nextHistory: AuditResultType[]) => {
    setHistory(nextHistory);
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(nextHistory),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUrl = url.trim();

    if (!trimmedUrl || !isValidWebsiteUrl(trimmedUrl)) {
      setError(getInvalidUrlMessage());
      setErrorDebug({
        code: "INVALID_URL",
        hint: "Use a full URL including http:// or https://.",
        targetUrl: trimmedUrl,
      });
      setResult(null);
      return;
    }

    setError("");
    setErrorDebug(null);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(auditApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Unable to complete the audit.";

        setError(message);
        if (
          typeof data === "object" &&
          data !== null &&
          "debug" in data &&
          typeof data.debug === "object" &&
          data.debug !== null
        ) {
          setErrorDebug(data.debug as AuditErrorDebug);
        }
        return;
      }

      const auditResult = data as AuditResultType;
      const nextHistory = [
        auditResult,
        ...history.filter(
          (report) =>
            !(
              report.url === auditResult.url &&
              report.auditedAt === auditResult.auditedAt
            ),
        ),
      ].slice(0, MAX_HISTORY_ITEMS);

      setResult(auditResult);
      saveHistory(nextHistory);
    } catch {
      setError(
        "A network error interrupted the audit request. Check your connection and try again.",
      );
      setErrorDebug({
        code: "FRONTEND_NETWORK_FAILURE",
        hint: `The browser could not complete the request to ${auditApiUrl}.`,
        targetUrl: trimmedUrl,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (report: AuditResultType) => {
    setUrl(report.url);
    setResult(report);
    setError("");
    setErrorDebug(null);
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_48%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10 lg:px-10 lg:py-10">
            <div className="space-y-7 sm:space-y-8">
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                MVP Preview
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-950 sm:text-5xl lg:text-6xl">
                  Frontend QA Checker
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                  Run a hosted-safe frontend quality audit on any public
                  website and generate a clean QA report with metadata checks,
                  image findings, and desktop plus mobile reachability results.
                </p>
              </div>

              <UrlAuditForm
                url={url}
                isLoading={isLoading}
                onUrlChange={setUrl}
                onSubmit={handleSubmit}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Checks in MVP" value="6" />
                <StatCard label="Audit mode" value="Hosted-safe" />
                <StatCard label="Target experience" value="< 20 sec" />
              </div>

              <ReportHistory
                history={history}
                onSelect={handleHistorySelect}
                onClear={handleClearHistory}
              />
            </div>

            <aside className="rounded-[28px] bg-slate-950 p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:sticky lg:top-8 lg:self-start">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.22em] text-sky-300">
                    Local Storage
                  </p>
                  <h2 className="text-2xl font-semibold">How History Works</h2>
                  <p className="text-sm leading-6 text-slate-300">
                    Your latest audit reports are stored locally in this browser
                    only. History is capped at 10 reports to keep the MVP fast
                    and simple, and the hosted-safe audit route avoids fragile
                    browser automation in production.
                  </p>
                </div>

                <div className="space-y-3">
                  <InfoCard
                    title="Auto-save"
                    description="Every successful audit is saved automatically."
                  />
                  <InfoCard
                    title="Quick reload"
                    description="Click any saved report below the form to reopen it."
                  />
                  <InfoCard
                    title="Max 10 reports"
                    description="Older reports are trimmed automatically as new ones are added."
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Audit Status
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live request state for the current audit run.
                </p>
              </div>
              <StatusBadge
                label={
                  isLoading ? "Running" : result ? "Completed" : "Waiting"
                }
              />
            </div>

            <div
              className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5"
              aria-live="polite"
            >
              {isLoading ? (
                <div className="space-y-4" role="status" aria-label="Audit running">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500" />
                    </span>
                    <p className="text-sm font-medium text-slate-700">
                      Running audit checks...
                    </p>
                  </div>
                  <div className="space-y-3">
                    <SkeletonBar />
                    <SkeletonBar />
                    <SkeletonBar />
                  </div>
                </div>
              ) : error ? (
                <div className="space-y-3">
                  <div
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                    role="alert"
                  >
                    {error}
                  </div>
                  {isDevelopment && errorDebug ? (
                    <DebugPanel debug={errorDebug} />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>
                    Enter a public URL and click{" "}
                    <span className="font-medium text-slate-900">
                      Run Audit
                    </span>{" "}
                    to generate a hosted-safe frontend QA report.
                  </p>
                  <p>
                    This MVP uses server-side HTML and asset analysis so it can
                    run reliably on standard hosting. Browser-level checks are
                    intentionally out of scope for this deployed version.
                  </p>
                  {isDevelopment ? (
                    <p className="break-all text-xs text-slate-500">
                      Current audit endpoint: {auditApiUrl}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Results
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Quality snapshot for the latest audited page.
                </p>
              </div>
            </div>

            {result ? (
              <AuditResult result={result} />
            ) : (
              <div className="mt-6 flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-7 text-slate-500 sm:min-h-80">
                {isLoading
                  ? "We're preparing your audit report now."
                  : error
                    ? "The audit did not complete. Fix the issue above and try again."
                    : "Your report will appear here after you run an audit."}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
      {label}
    </span>
  );
}

function SkeletonBar() {
  return (
    <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-slate-300" />
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function DebugPanel({ debug }: { debug: AuditErrorDebug }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        Dev Debug
      </p>
      <div className="mt-3 space-y-2 leading-6">
        <p>
          <span className="font-semibold">Code:</span> {debug.code}
        </p>
        {debug.targetUrl ? (
          <p className="break-all">
            <span className="font-semibold">Target:</span> {debug.targetUrl}
          </p>
        ) : null}
        {debug.hint ? (
          <p>
            <span className="font-semibold">Hint:</span> {debug.hint}
          </p>
        ) : null}
        {debug.technicalMessage ? (
          <p className="break-all">
            <span className="font-semibold">Technical:</span>{" "}
            {debug.technicalMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
