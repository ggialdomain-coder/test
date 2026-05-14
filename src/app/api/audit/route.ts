import { mkdir } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import { calculateAuditScore } from "@/lib/calculateAuditScore";
import type {
  AccessibilityIssue,
  AuditErrorDebug,
  AuditRequest,
  AuditResult,
  ConsoleIssue,
  ImageIssue,
  ViewportStatus,
} from "@/types/audit";

const NAVIGATION_TIMEOUT_MS = 15000;
const PAGE_LOAD_TIMEOUT_MS = 5000;
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "audit-screenshots",
);

type PageAuditData = {
  pageTitle: string;
  metaDescription: string;
  missingAltImages: ImageIssue[];
  brokenImages: ImageIssue[];
  accessibilityIssues: AccessibilityIssue[];
  screenshotUrl: string;
};

type ViewportAuditOutcome = {
  status: ViewportStatus;
  pageData?: PageAuditData;
};

type AuditErrorResponse = {
  error: string;
  debug?: AuditErrorDebug;
};

type BrowserLike = {
  newContext: (options: {
    viewport: { width: number; height: number };
    userAgent?: string;
    isMobile: boolean;
    deviceScaleFactor: number;
  }) => Promise<BrowserContextLike>;
  close: () => Promise<void>;
};

type BrowserContextLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  on: (
    event: "console",
    callback: (message: ConsoleMessageLike) => void,
  ) => void;
  goto: (
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ) => Promise<{
    ok: () => boolean;
    status: () => number;
  } | null>;
  waitForLoadState: (
    state: "load" | "networkidle",
    options: { timeout: number },
  ) => Promise<void>;
  title: () => Promise<string>;
  locator: (selector: string) => {
    first: () => {
      getAttribute: (name: string) => Promise<string | null>;
    };
    evaluateAll: <T>(pageFunction: (elements: Element[]) => T) => Promise<T>;
  };
  addScriptTag: (options: { content: string }) => Promise<unknown>;
  evaluate: <T>(pageFunction: () => Promise<T>) => Promise<T>;
  screenshot: (options: {
    path?: string;
    fullPage: boolean;
    type: "png";
  }) => Promise<Buffer>;
};

type ConsoleMessageLike = {
  type: () => string;
  text: () => string;
  location: () => {
    url?: string;
    lineNumber?: number;
  };
};

function getInvalidUrlMessage() {
  return "Enter a valid website URL that starts with http:// or https://.";
}

function isLocalDevelopmentUrl(targetUrl: string) {
  try {
    const parsed = new URL(targetUrl);
    return ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isSelfAuditTarget(targetUrl: string, requestUrl: string) {
  try {
    const target = new URL(targetUrl);
    const current = new URL(requestUrl);

    return target.host === current.host;
  } catch {
    return false;
  }
}

function isValidAuditRequest(body: unknown): body is AuditRequest {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Partial<AuditRequest>;

  return (
    typeof candidate.url === "string" &&
    /^(http:\/\/|https:\/\/)/i.test(candidate.url.trim())
  );
}

function createEmptyResult(url: string): AuditResult {
  return {
    url,
    auditedAt: new Date().toISOString(),
    pageTitle: "",
    metaDescription: "",
    missingAltImages: [],
    brokenImages: [],
    consoleErrors: [],
    accessibilityIssues: [],
    desktopStatus: {
      viewport: "desktop",
      loaded: false,
    },
    mobileStatus: {
      viewport: "mobile",
      loaded: false,
    },
    desktopScreenshotUrl: "",
    mobileScreenshotUrl: "",
    score: 0,
    status: "Poor",
  };
}

function createScreenshotFilename(
  targetUrl: string,
  viewport: "desktop" | "mobile",
  timestamp: string,
) {
  const hostname = new URL(targetUrl).hostname
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();

  return `${hostname}-${viewport}-${timestamp}.png`;
}

function shouldUseInlineScreenshots() {
  return process.env.NETLIFY === "true";
}

function isHostedDemoEnvironment() {
  return process.env.NETLIFY === "true";
}

function getFriendlyAuditError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("timeout")) {
    return "The website took too long to respond. Try again in a moment.";
  }

  if (
    message.includes("err_name_not_resolved") ||
    message.includes("err_internet_disconnected") ||
    message.includes("err_connection_refused") ||
    message.includes("err_connection_timed_out") ||
    message.includes("err_address_unreachable") ||
    message.includes("net::")
  ) {
    return "The website could not be reached. Check the URL and make sure the site is publicly accessible.";
  }

  if (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("err_cert")
  ) {
    return "The website could not be loaded because of an SSL or certificate issue.";
  }

  if (message.includes("browser") || message.includes("playwright")) {
    return "The audit browser ran into a problem while checking this website. Please try again.";
  }

  return "The website could not be audited right now. Please try again.";
}

function getAuditErrorDebug(error: unknown, targetUrl?: string): AuditErrorDebug {
  const technicalMessage =
    error instanceof Error ? error.message : "Unknown audit failure.";
  const message = technicalMessage.toLowerCase();

  if (message.includes("timeout")) {
    return {
      code: "AUDIT_TIMEOUT",
      technicalMessage,
      targetUrl,
      hint: "The target page did not finish loading within the audit timeout window.",
    };
  }

  if (
    message.includes("err_name_not_resolved") ||
    message.includes("err_internet_disconnected") ||
    message.includes("err_connection_refused") ||
    message.includes("err_connection_timed_out") ||
    message.includes("err_address_unreachable") ||
    message.includes("net::")
  ) {
    return {
      code: "UNREACHABLE_WEBSITE",
      technicalMessage,
      targetUrl,
      hint: "The browser could not reach the target host from the current environment.",
    };
  }

  if (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("err_cert")
  ) {
    return {
      code: "SSL_OR_CERTIFICATE_ERROR",
      technicalMessage,
      targetUrl,
      hint: "The target site returned an SSL or certificate problem during loading.",
    };
  }

  if (
    message.includes("spawn eperm") ||
    message.includes("browsertype.launch") ||
    message.includes("playwright")
  ) {
    return {
      code: "PLAYWRIGHT_LAUNCH_FAILURE",
      technicalMessage,
      targetUrl,
      hint: "The Playwright browser process could not start or was blocked by the local environment.",
    };
  }

  return {
    code: "AUDIT_RUNTIME_FAILURE",
    technicalMessage,
    targetUrl,
    hint: "The audit request failed before a more specific error could be identified.",
  };
}

function createErrorResponse(
  message: string,
  status: number,
  debug?: AuditErrorDebug,
) {
  const body: AuditErrorResponse = {
    error: message,
  };

  if (process.env.NODE_ENV !== "production" && debug) {
    body.debug = debug;
  }

  return NextResponse.json(body, { status });
}

function addConsoleIssue(
  issueMap: Map<string, ConsoleIssue>,
  message: ConsoleMessageLike,
) {
  if (message.type() !== "error") {
    return;
  }

  const location = message.location();
  const locationValue =
    location.url && typeof location.lineNumber === "number"
      ? `${location.url}:${location.lineNumber}`
      : location.url || undefined;

  const issue: ConsoleIssue = {
    type: message.type(),
    message: message.text(),
    location: locationValue,
  };

  const key = `${issue.type}:${issue.message}:${issue.location ?? ""}`;
  issueMap.set(key, issue);
}

async function collectPageAuditData(
  targetUrl: string,
  viewport: "desktop" | "mobile",
  size: { width: number; height: number },
  browser: BrowserLike,
  consoleIssueMap: Map<string, ConsoleIssue>,
  screenshotFilePath?: string,
  screenshotUrl?: string,
  axeSource?: string,
): Promise<ViewportAuditOutcome> {
  const context = await browser.newContext({
    viewport: size,
    userAgent:
      viewport === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        : undefined,
    isMobile: viewport === "mobile",
    deviceScaleFactor: viewport === "mobile" ? 3 : 1,
  });

  try {
    const page = await context.newPage();

    page.on("console", (message: ConsoleMessageLike) =>
      addConsoleIssue(consoleIssueMap, message),
    );

    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page
      .waitForLoadState("load", {
        timeout: PAGE_LOAD_TIMEOUT_MS,
      })
      .catch(() => {
        return undefined;
      });

    if (!isLocalDevelopmentUrl(targetUrl)) {
      await page
        .waitForLoadState("networkidle", {
          timeout: PAGE_LOAD_TIMEOUT_MS,
        })
        .catch(() => {
          return undefined;
        });
    }

    if (!response) {
      return {
        status: {
          viewport,
          loaded: false,
          errorMessage:
            "The website did not return a response for this viewport check.",
        },
      };
    }

    if (!response.ok()) {
      return {
        status: {
          viewport,
          loaded: false,
          statusCode: response.status(),
          errorMessage:
            response.status() >= 500
              ? "The website returned a server error during loading."
              : "The website could not be loaded successfully in this viewport.",
        },
      };
    }

    const pageTitle = await page.title();
    const metaDescription = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute("content");

    const missingAltImages = await page
      .locator("img")
      .evaluateAll((images: Element[]) => {
      return (images as HTMLImageElement[])
        .filter((image) => !image.hasAttribute("alt"))
        .map((image) => ({
          src: image.getAttribute("src") || "",
          reason: "missing-alt" as const,
          alt: image.getAttribute("alt"),
        }));
      });

    const brokenImages = await page
      .locator("img")
      .evaluateAll((images: Element[]) => {
      return (images as HTMLImageElement[])
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => ({
          src: image.getAttribute("src") || "",
          reason: "broken" as const,
          alt: image.getAttribute("alt"),
        }));
      });

    let accessibilityIssues: AccessibilityIssue[] = [];

    if (axeSource) {
      await page.addScriptTag({
        content: axeSource,
      });

      accessibilityIssues = await page.evaluate(async () => {
      type AxeRunResult = {
        violations: Array<{
          id: string;
          impact?: string | null;
          description: string;
          help: string;
          nodes: Array<{
            target: string[];
          }>;
        }>;
      };

      const axeGlobal = (
        window as unknown as Window & {
          axe: {
            run: () => Promise<AxeRunResult>;
          };
        }
      ).axe;

      const results = await axeGlobal.run();

      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        description: violation.description,
        help: violation.help,
        selectors: violation.nodes.flatMap((node) => node.target),
        nodes: violation.nodes.length,
      }));
      });
    }

    const screenshotBuffer = await page.screenshot({
      path: screenshotFilePath,
      fullPage: true,
      type: "png",
    });

    const resolvedScreenshotUrl =
      shouldUseInlineScreenshots() || !screenshotUrl
        ? `data:image/png;base64,${screenshotBuffer.toString("base64")}`
        : screenshotUrl;

    return {
      status: {
        viewport,
        loaded: true,
        statusCode: response.status(),
      },
      pageData: {
        pageTitle,
        metaDescription: metaDescription ?? "",
        missingAltImages,
        brokenImages,
        accessibilityIssues,
        screenshotUrl: resolvedScreenshotUrl,
      },
    };
  } catch (error) {
    return {
      status: {
        viewport,
        loaded: false,
        errorMessage: getFriendlyAuditError(error),
      },
    };
  } finally {
    await context.close();
  }
}

export async function POST(request: NextRequest) {
  let browser: BrowserLike | null = null;

  try {
    const body: unknown = await request.json();

    if (!isValidAuditRequest(body)) {
      return createErrorResponse(
        getInvalidUrlMessage(),
        400,
        {
          code: "INVALID_URL",
          hint: "Use a full URL including http:// or https://.",
        },
      );
    }

    const url = body.url.trim();

    if (isHostedDemoEnvironment()) {
      return createErrorResponse(
        "This hosted demo is available online, but live website auditing is disabled in the serverless environment. Use local development for real audits.",
        501,
        {
          code: "HOSTED_DEMO_AUDIT_DISABLED",
          targetUrl: url,
          hint: "The Netlify deployment is running in demo mode because Playwright-based browser auditing is not enabled there.",
        },
      );
    }

    if (isSelfAuditTarget(url, request.url)) {
      return createErrorResponse(
        "This local development URL is serving the dashboard itself. For local testing, audit a different app URL or use a public website.",
        400,
        {
          code: "SELF_AUDIT_BLOCKED",
          targetUrl: url,
          hint: "Run the audit against another local app port or a public website.",
        },
      );
    }

    const consoleIssueMap = new Map<string, ConsoleIssue>();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const desktopFilename = createScreenshotFilename(url, "desktop", timestamp);
    const mobileFilename = createScreenshotFilename(url, "mobile", timestamp);
    const desktopScreenshotUrl = `/audit-screenshots/${desktopFilename}`;
    const mobileScreenshotUrl = `/audit-screenshots/${mobileFilename}`;
    const persistScreenshotsToPublic = !shouldUseInlineScreenshots();
    const desktopScreenshotPath = persistScreenshotsToPublic
      ? path.join(SCREENSHOT_DIRECTORY, desktopFilename)
      : undefined;
    const mobileScreenshotPath = persistScreenshotsToPublic
      ? path.join(SCREENSHOT_DIRECTORY, mobileFilename)
      : undefined;

    if (persistScreenshotsToPublic) {
      await mkdir(SCREENSHOT_DIRECTORY, { recursive: true });
    }

    const [{ chromium }, axeModule] = await Promise.all([
      import("playwright"),
      import("axe-core"),
    ]);

    browser = await chromium.launch({
      headless: true,
    });

    const axeSource = axeModule.default.source;

    const desktopAudit = await collectPageAuditData(
      url,
      "desktop",
      { width: 1440, height: 900 },
      browser,
      consoleIssueMap,
      desktopScreenshotPath,
      desktopScreenshotUrl,
      axeSource,
    );

    const mobileAudit = await collectPageAuditData(
      url,
      "mobile",
      { width: 390, height: 844 },
      browser,
      consoleIssueMap,
      mobileScreenshotPath,
      mobileScreenshotUrl,
      axeSource,
    );

    if (!desktopAudit.status.loaded && !mobileAudit.status.loaded) {
      return createErrorResponse(
        desktopAudit.status.errorMessage ||
          mobileAudit.status.errorMessage ||
          "The website could not be loaded in either viewport.",
        502,
        {
          code: "BOTH_VIEWPORTS_FAILED",
          targetUrl: url,
          hint: "Both desktop and mobile checks failed before the page could be audited.",
        },
      );
    }

    const primaryData = desktopAudit.pageData ?? mobileAudit.pageData;
    const resultWithoutScore = {
      ...createEmptyResult(url),
      auditedAt: new Date().toISOString(),
      pageTitle: primaryData?.pageTitle ?? "",
      metaDescription: primaryData?.metaDescription ?? "",
      missingAltImages: primaryData?.missingAltImages ?? [],
      brokenImages: primaryData?.brokenImages ?? [],
      consoleErrors: Array.from(consoleIssueMap.values()),
      accessibilityIssues: primaryData?.accessibilityIssues ?? [],
      desktopStatus: desktopAudit.status,
      mobileStatus: mobileAudit.status,
      desktopScreenshotUrl: desktopAudit.pageData?.screenshotUrl ?? "",
      mobileScreenshotUrl: mobileAudit.pageData?.screenshotUrl ?? "",
    };

    const result: AuditResult = {
      ...resultWithoutScore,
      ...calculateAuditScore(resultWithoutScore),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      getFriendlyAuditError(error),
      500,
      getAuditErrorDebug(error),
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
