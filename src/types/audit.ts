export type AuditStatus =
  | "Excellent"
  | "Good"
  | "Needs Improvement"
  | "Poor";

export type AuditMode = "hosted-safe" | "browser";

export type AuditErrorDebug = {
  code: string;
  technicalMessage?: string;
  targetUrl?: string;
  hint?: string;
};

export type AuditRequest = {
  url: string;
};

export type ImageIssue = {
  src: string;
  reason: "missing-alt" | "broken";
  alt?: string | null;
};

export type ConsoleIssue = {
  type: string;
  message: string;
  location?: string;
};

export type AccessibilityIssue = {
  id: string;
  impact?: string | null;
  description: string;
  help: string;
  selectors: string[];
  nodes: number;
};

export type ViewportStatus = {
  viewport: "desktop" | "mobile";
  loaded: boolean;
  statusCode?: number;
  errorMessage?: string;
};

export type AuditResult = {
  auditMode: AuditMode;
  url: string;
  auditedAt: string;
  pageTitle: string;
  metaDescription: string;
  missingAltImages: ImageIssue[];
  brokenImages: ImageIssue[];
  consoleErrors: ConsoleIssue[];
  accessibilityIssues: AccessibilityIssue[];
  desktopStatus: ViewportStatus;
  mobileStatus: ViewportStatus;
  desktopScreenshotUrl: string;
  mobileScreenshotUrl: string;
  score: number;
  status: AuditStatus;
};
