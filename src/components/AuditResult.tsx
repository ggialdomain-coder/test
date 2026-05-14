"use client";

import Image from "next/image";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRef, useState } from "react";

import { AuditScoreCard } from "@/components/AuditScoreCard";
import { AuditSummaryCards } from "@/components/AuditSummaryCards";
import type { AuditResult as AuditResultType } from "@/types/audit";

import { AuditSection } from "@/components/AuditSection";
import { PdfExportButton } from "@/components/PdfExportButton";

type AuditResultProps = {
  result: AuditResultType;
};

export function AuditResult({ result }: AuditResultProps) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const totalIssueCount =
    result.missingAltImages.length +
    result.brokenImages.length +
    result.consoleErrors.length +
    result.accessibilityIssues.length;

  const seoIssues = [
    ...(!result.pageTitle ? ["Missing page title."] : []),
    ...(!result.metaDescription ? ["Missing meta description."] : []),
  ];

  const imageIssues = [
    ...result.missingAltImages.map(
      (image) => `Missing alt: ${image.src || "Unknown image source"}`,
    ),
    ...result.brokenImages.map(
      (image) => `Broken image: ${image.src || "Unknown image source"}`,
    ),
  ];

  const consoleIssues = result.consoleErrors.map((issue) =>
    issue.location ? `${issue.message} (${issue.location})` : issue.message,
  );

  const accessibilityIssues = result.accessibilityIssues.map((issue) => {
    const impactLabel = issue.impact ? `${issue.impact} impact` : "impact not set";
    const selectorList =
      issue.selectors.length > 0
        ? issue.selectors.map((selector) => `- ${selector}`).join("\n")
        : "- No selector data returned";

    return [
      `${issue.id}: ${issue.help}`,
      issue.description,
      `${impactLabel}, ${issue.nodes} node(s) affected`,
      "Affected selectors:",
      selectorList,
    ].join("\n");
  });

  const responsiveIssues = [
    ...(!result.desktopStatus.loaded
      ? [
          `Desktop check failed: ${
            result.desktopStatus.errorMessage || "Unable to load desktop viewport."
          }`,
        ]
      : []),
    ...(!result.mobileStatus.loaded
      ? [
          `Mobile check failed: ${
            result.mobileStatus.errorMessage || "Unable to load mobile viewport."
          }`,
        ]
      : []),
  ];

  const handleDownloadPdf = async () => {
    if (!reportRef.current || isExportingPdf) {
      return;
    }

    try {
      setIsExportingPdf(true);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f8fafc",
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;

      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("frontend-qa-report.pdf");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="mt-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            Export Report
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Download the visible audit report as a client-side PDF.
          </p>
        </div>
        <PdfExportButton
          isExporting={isExportingPdf}
          onClick={handleDownloadPdf}
        />
      </div>

      <div
        ref={reportRef}
        className="space-y-6 rounded-[28px] bg-slate-50/80 p-1 sm:space-y-7"
      >
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetaCard label="Audit URL" value={result.url} />
            <MetaCard
              label="Audit Date"
              value={new Date(result.auditedAt).toLocaleString()}
            />
            <MetaCard label="Status" value={result.status} />
            <MetaCard label="Summary" value={`${totalIssueCount} issue(s) found`} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <AuditScoreCard score={result.score} status={result.status} />
          <AuditSummaryCards
            items={[
              {
                label: "Page Title",
                value: result.pageTitle || "Not found",
                tone: result.pageTitle ? "positive" : "negative",
              },
              {
                label: "Meta Description",
                value: result.metaDescription || "Not found",
                tone: result.metaDescription ? "positive" : "negative",
              },
              {
                label: "Desktop Status",
                value: result.desktopStatus.loaded
                  ? `Passed (${result.desktopStatus.statusCode ?? "OK"})`
                  : "Failed",
                tone: result.desktopStatus.loaded ? "positive" : "negative",
              },
              {
                label: "Mobile Status",
                value: result.mobileStatus.loaded
                  ? `Passed (${result.mobileStatus.statusCode ?? "OK"})`
                  : "Failed",
                tone: result.mobileStatus.loaded ? "positive" : "negative",
              },
              {
                label: "Issue Count",
                value: String(totalIssueCount),
                tone: totalIssueCount === 0 ? "positive" : "negative",
              },
              {
                label: "Image Issues",
                value: String(imageIssues.length),
                tone: imageIssues.length === 0 ? "positive" : "negative",
              },
              {
                label: "Console Errors",
                value: String(result.consoleErrors.length),
                tone:
                  result.consoleErrors.length === 0 ? "positive" : "negative",
              },
              {
                label: "Accessibility Issues",
                value: String(result.accessibilityIssues.length),
                tone:
                  result.accessibilityIssues.length === 0
                    ? "positive"
                    : "negative",
              },
            ]}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <AuditSection
            title="SEO"
            summary={
              seoIssues.length === 0
                ? "Page title and meta description checks passed."
                : `${seoIssues.length} SEO issue(s) need review.`
            }
            status={seoIssues.length === 0 ? "pass" : "fail"}
            items={seoIssues}
            emptyMessage="No issues found."
          />
          <AuditSection
            title="Images"
            summary={
              imageIssues.length === 0
                ? "Image alt text and asset rendering checks passed."
                : `${imageIssues.length} image issue(s) need review.`
            }
            status={imageIssues.length === 0 ? "pass" : "fail"}
            items={imageIssues}
            emptyMessage="No issues found."
          />
          <AuditSection
            title="Console Errors"
            summary={
              consoleIssues.length === 0
                ? "No console errors were captured during page load."
                : `${consoleIssues.length} console error(s) were captured.`
            }
            status={consoleIssues.length === 0 ? "pass" : "fail"}
            items={consoleIssues}
            emptyMessage="No issues found."
            defaultOpen={consoleIssues.length > 0}
          />
          <AuditSection
            title="Accessibility"
            summary={
              accessibilityIssues.length === 0
                ? "No accessibility issues were returned in this audit response."
                : `${accessibilityIssues.length} accessibility issue(s) need review.`
            }
            status={accessibilityIssues.length === 0 ? "pass" : "fail"}
            items={accessibilityIssues}
            emptyMessage="No issues found."
            defaultOpen={accessibilityIssues.length > 0}
          />
          <AuditSection
            title="Responsive Checks"
            summary={
              responsiveIssues.length === 0
                ? "Desktop and mobile viewport checks both passed."
                : `${responsiveIssues.length} responsive check(s) need review.`
            }
            status={responsiveIssues.length === 0 ? "pass" : "fail"}
            items={responsiveIssues}
            emptyMessage="No issues found."
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ScreenshotCard
            title="Desktop Screenshot"
            imageUrl={result.desktopScreenshotUrl}
            altText={`Desktop audit screenshot for ${result.url}`}
          />
          <ScreenshotCard
            title="Mobile Screenshot"
            imageUrl={result.mobileScreenshotUrl}
            altText={`Mobile audit screenshot for ${result.url}`}
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Audited URL</p>
          <p className="mt-2 break-all text-sm text-slate-600">{result.url}</p>
        </div>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 break-all text-base font-semibold leading-6 text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ScreenshotCard({
  title,
  imageUrl,
  altText,
}: {
  title: string;
  imageUrl: string;
  altText: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          {title}
        </h3>
      </div>
      <div className="bg-slate-50 p-4">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText}
            width={1600}
            height={900}
            className="h-auto w-full rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
          />
        ) : (
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center text-sm leading-6 text-slate-500">
            Screenshot not available for this viewport.
          </div>
        )}
      </div>
    </div>
  );
}
