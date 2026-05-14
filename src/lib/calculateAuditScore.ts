import type { AccessibilityIssue, AuditResult, AuditStatus } from "@/types/audit";

type AuditResultWithoutScore = Omit<AuditResult, "score" | "status">;

function getAccessibilityDeduction(issues: AccessibilityIssue[]) {
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

function getStatusFromScore(score: number): AuditStatus {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 50) {
    return "Needs Improvement";
  }

  return "Poor";
}

export function calculateAuditScore(result: AuditResultWithoutScore): Pick<AuditResult, "score" | "status"> {
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
