import type { RiskFilterOptions, RiskSummaryRead } from "../types/risk";

export class RiskClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "RISK_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "RiskClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function clientGetProjectRisks(
  projectId: string,
  options?: RiskFilterOptions
): Promise<RiskSummaryRead> {
  const url = new URL(
    `/api/projects/${projectId}/risks`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

  if (options?.severity && options.severity !== "all") {
    url.searchParams.set("severity", options.severity);
  }
  if (options?.category && options.category !== "all") {
    url.searchParams.set("category", options.category);
  }
  if (options?.source_type && options.source_type !== "all") {
    url.searchParams.set("source_type", options.source_type);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new RiskClientError(
      body?.error?.message || "Failed to load project risks.",
      body?.error?.code || "RISK_LOAD_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as RiskSummaryRead;
}
