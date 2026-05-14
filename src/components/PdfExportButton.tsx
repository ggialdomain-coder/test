"use client";

type PdfExportButtonProps = {
  isExporting: boolean;
  onClick: () => void;
};

export function PdfExportButton({
  isExporting,
  onClick,
}: PdfExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isExporting}
      className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {isExporting ? "Generating PDF..." : "Download PDF Report"}
    </button>
  );
}
