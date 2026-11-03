import type {
  KnowledgeItemDetailRead,
  KnowledgeItemRead,
  KnowledgeItemReviewRequest,
  BulkReviewRequest,
  BulkReviewResponse,
  KnowledgeFilterOptions,
} from "../types/knowledge";

export class KnowledgeClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "KNOWLEDGE_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "KnowledgeClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function fetchKnowledgeListClient(
  projectId: string,
  filters?: Partial<KnowledgeFilterOptions>
): Promise<KnowledgeItemRead[]> {
  const url = new URL(
    `/api/projects/${projectId}/knowledge`,
    window.location.origin
  );

  if (filters?.category && filters.category !== "all") {
    url.searchParams.set("category", filters.category);
  }
  if (filters?.review_status && filters.review_status !== "all") {
    url.searchParams.set("review_status", filters.review_status);
  }
  if (filters?.origin && filters.origin !== "all") {
    url.searchParams.set("origin", filters.origin);
  }
  if (typeof filters?.verified === "boolean") {
    url.searchParams.set("verified", String(filters.verified));
  }
  if (filters?.q && filters.q.trim()) {
    url.searchParams.set("q", filters.q.trim());
  }
  if (typeof filters?.min_confidence === "number") {
    url.searchParams.set("min_confidence", String(filters.min_confidence));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to retrieve project knowledge.";
    throw new KnowledgeClientError(
      errorMsg,
      data?.error?.code,
      res.status,
      data?.error?.details
    );
  }

  return (data.items || []) as KnowledgeItemRead[];
}

export async function fetchKnowledgeDetailClient(
  projectId: string,
  itemId: string
): Promise<KnowledgeItemDetailRead> {
  const res = await fetch(`/api/projects/${projectId}/knowledge/${itemId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to retrieve knowledge item details.";
    throw new KnowledgeClientError(
      errorMsg,
      data?.error?.code,
      res.status,
      data?.error?.details
    );
  }

  return data.item as KnowledgeItemDetailRead;
}

export async function reviewKnowledgeItemClient(
  projectId: string,
  itemId: string,
  payload: KnowledgeItemReviewRequest
): Promise<KnowledgeItemDetailRead> {
  const res = await fetch(
    `/api/projects/${projectId}/knowledge/${itemId}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to update review status.";
    throw new KnowledgeClientError(
      errorMsg,
      data?.error?.code,
      res.status,
      data?.error?.details
    );
  }

  return data.item as KnowledgeItemDetailRead;
}

export async function bulkReviewKnowledgeClient(
  projectId: string,
  payload: BulkReviewRequest
): Promise<BulkReviewResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/knowledge/bulk-review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to execute bulk review.";
    throw new KnowledgeClientError(
      errorMsg,
      data?.error?.code,
      res.status,
      data?.error?.details
    );
  }

  return data.result as BulkReviewResponse;
}
