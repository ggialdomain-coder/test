export function getAuditApiUrl() {
  const configuredBase = process.env.NEXT_PUBLIC_AUDIT_API_BASE_URL?.trim();

  if (!configuredBase) {
    return "/api/audit";
  }

  const normalizedBase = configuredBase.endsWith("/")
    ? configuredBase.slice(0, -1)
    : configuredBase;

  return `${normalizedBase}/api/audit`;
}
