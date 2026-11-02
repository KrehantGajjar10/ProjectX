export function sanitizeRedirectUrl(
  rawUrl?: string | null,
  fallback = "/app"
): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  // Must begin with a single slash, not protocol-relative "//" or external URL scheme
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//") && !rawUrl.includes("://")) {
    return rawUrl;
  }

  return fallback;
}
