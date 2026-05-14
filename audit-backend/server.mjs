import http from "node:http";

import axe from "axe-core";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const NAVIGATION_TIMEOUT_MS = 15000;
const PAGE_LOAD_TIMEOUT_MS = 5000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function getInvalidUrlMessage() {
  return "Enter a valid website URL that starts with http:// or https://.";
}

function isValidAuditRequest(body) {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.url === "string" &&
    /^(http:\/\/|https:\/\/)/i.test(body.url.trim())
  );
}

function getFriendlyAuditError(error) {
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

  return "The website could not be audited right now. Please try again.";
}

function getAuditErrorDebug(error, targetUrl) {
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

  return {
    code: "AUDIT_RUNTIME_FAILURE",
    technicalMessage,
    targetUrl,
    hint: "The audit request failed before a more specific error could be identified.",
  };
}

function createErrorPayload(error, statusCode, debug) {
  const payload = { error };

  if (process.env.NODE_ENV !== "production" && debug) {
    payload.debug = debug;
  }

  return { statusCode, payload };
}

function createEmptyResult(url) {
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

function getAccessibilityDeduction(issues) {
  const total = issues.reduce((sum, issue) => {
    switch (issue.impact) {
      case "critical":
        return sum + 10;
      case "serious":
        return sum + 7;
      case "moderate":
        return sum + 4;
      case "minor":
        return sum + 2;
      default:
        return sum;
    }
  }, 0);

  return Math.min(total, 30);
}

function getStatusFromScore(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}

function calculateAuditScore(result) {
  let score = 100;

  score -= Math.min(result.missingAltImages.length * 5, 20);
  score -= Math.min(result.brokenImages.length * 10, 30);
  score -= Math.min(result.consoleErrors.length * 5, 25);

  if (!result.desktopStatus.loaded) {
    score -= 20;
  }

  if (!result.mobileStatus.loaded) {
    score -= 20;
  }

  score -= getAccessibilityDeduction(result.accessibilityIssues);

  const normalizedScore = Math.max(0, score);

  return {
    score: normalizedScore,
    status: getStatusFromScore(normalizedScore),
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function collectPageAuditData(targetUrl, viewport, size, browser, consoleIssueMap) {
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

    page.on("console", (message) => {
      if (message.type() !== "error") {
        return;
      }

      const location = message.location();
      const issue = {
        type: message.type(),
        message: message.text(),
        location:
          location.url && typeof location.lineNumber === "number"
            ? `${location.url}:${location.lineNumber}`
            : location.url || undefined,
      };

      consoleIssueMap.set(
        `${issue.type}:${issue.message}:${issue.location || ""}`,
        issue,
      );
    });

    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page.waitForLoadState("load", {
      timeout: PAGE_LOAD_TIMEOUT_MS,
    }).catch(() => undefined);

    await page.waitForLoadState("networkidle", {
      timeout: PAGE_LOAD_TIMEOUT_MS,
    }).catch(() => undefined);

    if (!response) {
      return {
        status: {
          viewport,
          loaded: false,
          errorMessage: "The website did not return a response for this viewport check.",
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
      .evaluateAll((images) =>
        images
          .filter((image) => !image.hasAttribute("alt"))
          .map((image) => ({
            src: image.getAttribute("src") || "",
            reason: "missing-alt",
            alt: image.getAttribute("alt"),
          })),
      );

    const brokenImages = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => ({
            src: image.getAttribute("src") || "",
            reason: "broken",
            alt: image.getAttribute("alt"),
          })),
      );

    await page.addScriptTag({
      content: axe.source,
    });

    const accessibilityIssues = await page.evaluate(async () => {
      const results = await window.axe.run();

      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        description: violation.description,
        help: violation.help,
        selectors: violation.nodes.flatMap((node) => node.target),
        nodes: violation.nodes.length,
      }));
    });

    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });

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
        screenshotUrl: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
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

async function handleAudit(request, response) {
  let browser = null;

  try {
    const body = await readJsonBody(request);

    if (!isValidAuditRequest(body)) {
      const { statusCode, payload } = createErrorPayload(
        getInvalidUrlMessage(),
        400,
        {
          code: "INVALID_URL",
          hint: "Use a full URL including http:// or https://.",
        },
      );
      sendJson(response, statusCode, payload);
      return;
    }

    const url = body.url.trim();
    const consoleIssueMap = new Map();

    browser = await chromium.launch({ headless: true });

    const desktopAudit = await collectPageAuditData(
      url,
      "desktop",
      { width: 1440, height: 900 },
      browser,
      consoleIssueMap,
    );

    const mobileAudit = await collectPageAuditData(
      url,
      "mobile",
      { width: 390, height: 844 },
      browser,
      consoleIssueMap,
    );

    if (!desktopAudit.status.loaded && !mobileAudit.status.loaded) {
      const { statusCode, payload } = createErrorPayload(
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
      sendJson(response, statusCode, payload);
      return;
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

    const result = {
      ...resultWithoutScore,
      ...calculateAuditScore(resultWithoutScore),
    };

    sendJson(response, 200, result);
  } catch (error) {
    const { statusCode, payload } = createErrorPayload(
      getFriendlyAuditError(error),
      500,
      getAuditErrorDebug(error),
    );
    sendJson(response, statusCode, payload);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "frontend-qa-audit-backend",
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/audit") {
    await handleAudit(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Audit backend listening on http://localhost:${PORT}`);
});
