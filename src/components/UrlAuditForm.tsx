"use client";

type UrlAuditFormProps = {
  url: string;
  isLoading: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const auditTags = [
  "Title",
  "Meta description",
  "Images",
  "Broken assets",
  "Reachability",
  "PDF export",
];

export function UrlAuditForm({
  url,
  isLoading,
  onUrlChange,
  onSubmit,
}: UrlAuditFormProps) {
  return (
    <form
      className="space-y-5 rounded-[28px] border border-slate-200/90 bg-slate-50/85 p-4 shadow-sm sm:p-5"
      onSubmit={onSubmit}
      aria-busy={isLoading}
    >
      <label
        htmlFor="url"
        className="block text-sm font-semibold text-slate-800"
      >
        Website URL
      </label>
      <div className="flex flex-col gap-3 xl:flex-row">
        <input
          id="url"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          aria-label="Website URL"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus-visible:ring-4 focus-visible:ring-sky-100"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 xl:min-w-40"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Running Audit...
            </span>
          ) : (
            "Run Audit"
          )}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        {auditTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-slate-200/80 bg-white px-3 py-1"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900">
        <span className="font-semibold">Hosted-safe mode:</span> This MVP runs
        reliable HTML and asset checks that work well on standard hosting.
        Browser-rendered checks like console capture and automated
        accessibility scanning are planned for a later backend upgrade.
      </div>
    </form>
  );
}
