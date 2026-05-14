import { NextRequest, NextResponse } from "next/server";

import { calculateAuditScore } from "@/lib/calculateAuditScore";
import type {
  AuditErrorDebug,
  AuditRequest,
  AuditResult,
  ImageIssue,
  ViewportStatus,
} from "@/types/audit";

const PAGE_TIMEOUT_MS = 12000;
const IMAGE_TIMEOUT_MS = 5000;
const MAX_IMAGE_CHECKS = 12;

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type AuditErrorResponse = {
  error: string;
  debug?: AuditErrorDebug;
};

type FetchOutcome = {
  status: ViewportStatus;
  html?: string;
};

class AuditRouteError extends Error {
  code: string;
  status: number;
  hint?: string;

  constructor(code: string, message: string, status: number, hint?: string) {
    super(message);
    this.name = "AuditRouteError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

function getInvalidUrlMessage() {
  return "Enter a valid website URL that starts with http:// or https://.";
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
    auditMode: "hosted-safe",
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

function createErrorResponse(
  message: string,
  status: number,
  debug?: AuditErrorDebug,
) {
  const body: AuditErrorResponse = { error: message };

  if (process.env.NODE_ENV !== "production" && debug) {
    body.debug = debug;
  }

  return NextResponse.json(body, { status });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function normalizeText(value: string) {
  return decodeHtmlEntities(value.replace(/\s+/g, " ").trim());
}

function stripWrappingQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function getAttributeValue(tag: string, attributeName: string) {
  const attributePattern = new RegExp(
    `${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = tag.match(attributePattern);

  if (!match) {
    return null;
  }

  const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
  return normalizeText(stripWrappingQuotes(rawValue));
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeText(match[1]) : "";
}

function extractMetaDescription(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const name = getAttributeValue(tag, "name");

    if (name?.toLowerCase() === "description") {
      return getAttributeValue(tag, "content") ?? "";
    }
  }

  return "";
}

function extractImages(html: string, baseUrl: string) {
  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];

  return imageTags.map((tag) => {
    const rawSrc = getAttributeValue(tag, "src") ?? "";
    const altValue = getAttributeValue(tag, "alt");
    const hasAlt = /\balt\s*=/.test(tag);

    let resolvedSrc = rawSrc;

    if (rawSrc && !rawSrc.startsWith("data:")) {
      try {
        resolvedSrc = new URL(rawSrc, baseUrl).toString();
      } catch {
        resolvedSrc = rawSrc;
      }
    }

    return {
      src: resolvedSrc,
      alt: altValue,
      hasAlt,
    };
  });
}

function getFriendlyAuditError(error: unknown) {
  if (error instanceof AuditRouteError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("timeout") || message.includes("aborted")) {
    return "The website took too long to respond. Try again in a moment.";
  }

  if (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("ehostunreach") ||
    message.includes("unreachable")
  ) {
    return "The website could not be reached. Check the URL and make sure the site is publicly accessible.";
  }

  if (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("tls")
  ) {
    return "The website could not be loaded because of an SSL or certificate issue.";
  }

  return "The website could not be audited right now. Please try again.";
}

function getAuditErrorDebug(
  error: unknown,
  targetUrl?: string,
): AuditErrorDebug {
  if (error instanceof AuditRouteError) {
    return {
      code: error.code,
      targetUrl,
      hint: error.hint,
      technicalMessage: error.message,
    };
  }

  const technicalMessage =
    error instanceof Error ? error.message : "Unknown audit failure.";
  const message = technicalMessage.toLowerCase();

  if (message.includes("timeout") || message.includes("aborted")) {
    return {
      code: "AUDIT_TIMEOUT",
      technicalMessage,
      targetUrl,
      hint: "The target page did not respond before the hosted-safe audit timeout expired.",
    };
  }

  if (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("ehostunreach")
  ) {
    return {
      code: "UNREACHABLE_WEBSITE",
      technicalMessage,
      targetUrl,
      hint: "The server-side audit request could not reach the target website.",
    };
  }

  return {
    code: "AUDIT_RUNTIME_FAILURE",
    technicalMessage,
    targetUrl,
    hint: "The hosted-safe audit failed before a more specific error could be identified.",
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
    ) {
      throw new AuditRouteError(
        "AUDIT_TIMEOUT",
        "The website took too long to respond. Try again in a moment.",
        504,
        "The target page did not respond before the hosted-safe audit timeout expired.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchViewportHtml(
  url: string,
  viewport: "desktop" | "mobile",
): Promise<FetchOutcome> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "user-agent": viewport === "mobile" ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
          accept: "text/html,application/xhtml+xml",
        },
      },
      PAGE_TIMEOUT_MS,
    );

    if (!response.ok) {
      return {
        status: {
          viewport,
          loaded: false,
          statusCode: response.status,
          errorMessage:
            response.status >= 500
              ? "The website returned a server error during loading."
              : "The website could not be loaded successfully for this check.",
        },
      };
    }

    const html = await response.text();

    return {
      status: {
        viewport,
        loaded: true,
        statusCode: response.status,
      },
      html,
    };
  } catch (error) {
    return {
      status: {
        viewport,
        loaded: false,
        errorMessage: getFriendlyAuditError(error),
      },
    };
  }
}

function isSkippableImageSource(src: string) {
  return (
    !src ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("javascript:")
  );
}

async function isBrokenImage(url: string) {
  if (isSkippableImageSource(url)) {
    return false;
  }

  try {
    const headResponse = await fetchWithTimeout(
      url,
      { method: "HEAD" },
      IMAGE_TIMEOUT_MS,
    );

    const contentType = headResponse.headers.get("content-type") ?? "";

    if (!headResponse.ok) {
      return true;
    }

    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return true;
    }

    return false;
  } catch {
    try {
      const getResponse = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            range: "bytes=0-0",
          },
        },
        IMAGE_TIMEOUT_MS,
      );

      const contentType = getResponse.headers.get("content-type") ?? "";
      return !getResponse.ok || !contentType.toLowerCase().startsWith("image/");
    } catch {
      return true;
    }
  }
}

async function collectBrokenImages(images: ImageIssue[]) {
  const uniqueCandidates = Array.from(
    new Map(images.map((image) => [image.src, image])).values(),
  )
    .filter((image) => !isSkippableImageSource(image.src))
    .slice(0, MAX_IMAGE_CHECKS);

  const checks = await Promise.all(
    uniqueCandidates.map(async (image) => ({
      image,
      broken: await isBrokenImage(image.src),
    })),
  );

  return checks
    .filter((entry) => entry.broken)
    .map((entry) => ({
      ...entry.image,
      reason: "broken" as const,
    }));
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isValidAuditRequest(body)) {
      return createErrorResponse(getInvalidUrlMessage(), 400, {
        code: "INVALID_URL",
        hint: "Use a full URL including http:// or https://.",
      });
    }

    const url = body.url.trim();
    const [desktopFetch, mobileFetch] = await Promise.all([
      fetchViewportHtml(url, "desktop"),
      fetchViewportHtml(url, "mobile"),
    ]);

    if (!desktopFetch.status.loaded && !mobileFetch.status.loaded) {
      throw new AuditRouteError(
        "BOTH_VIEWPORTS_FAILED",
        desktopFetch.status.errorMessage ||
          mobileFetch.status.errorMessage ||
          "The website could not be loaded in either check.",
        502,
        "Both hosted-safe reachability checks failed before the page HTML could be analyzed.",
      );
    }

    const primaryHtml = desktopFetch.html ?? mobileFetch.html ?? "";
    const pageTitle = extractTitle(primaryHtml);
    const metaDescription = extractMetaDescription(primaryHtml);
    const images = extractImages(primaryHtml, url);

    const missingAltImages: ImageIssue[] = images
      .filter((image) => !image.hasAlt)
      .map((image) => ({
        src: image.src,
        alt: image.alt,
        reason: "missing-alt",
      }));

    const brokenImages = await collectBrokenImages(
      images.map((image) => ({
        src: image.src,
        alt: image.alt,
        reason: "broken",
      })),
    );

    const resultWithoutScore = {
      ...createEmptyResult(url),
      auditedAt: new Date().toISOString(),
      pageTitle,
      metaDescription,
      missingAltImages,
      brokenImages,
      desktopStatus: desktopFetch.status,
      mobileStatus: mobileFetch.status,
    };

    const result: AuditResult = {
      ...resultWithoutScore,
      ...calculateAuditScore(resultWithoutScore),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = error instanceof AuditRouteError ? error.status : 500;

    return createErrorResponse(
      getFriendlyAuditError(error),
      status,
      getAuditErrorDebug(error),
    );
  }
}
