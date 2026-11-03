import type {
  QARequest,
  QAResponse,
  SearchFilterOptions,
  SearchResultsResponse,
} from "../types/search";

export class SearchClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "SEARCH_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "SearchClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function clientPlainSearch(
  projectId: string,
  options: SearchFilterOptions
): Promise<SearchResultsResponse> {
  const url = new URL(
    `/api/projects/${projectId}/search`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

  url.searchParams.set("q", options.q.trim());
  if (options.category && options.category !== "all") {
    url.searchParams.set("category", options.category);
  }
  if (options.verified_only) {
    url.searchParams.set("verified_only", "true");
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new SearchClientError(
      body?.error?.message || "Search failed.",
      body?.error?.code || "SEARCH_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as SearchResultsResponse;
}

export async function clientAskQuestion(
  projectId: string,
  request: QARequest
): Promise<QAResponse> {
  const res = await fetch(`/api/projects/${projectId}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...request,
      include_answer: true,
    }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new SearchClientError(
      body?.error?.message || "AI Q&A request failed.",
      body?.error?.code || "QA_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as QAResponse;
}
