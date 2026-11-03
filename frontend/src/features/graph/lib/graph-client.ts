import type {
  DependencyGraphResponse,
  GraphFilterOptions,
  Neo4jSyncResponse,
  SubgraphResponse,
} from "../types/graph";

export class GraphClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "GRAPH_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "GraphClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function clientGetProjectGraph(
  projectId: string,
  options?: GraphFilterOptions
): Promise<DependencyGraphResponse> {
  const url = new URL(
    `/api/projects/${projectId}/dependencies/graph`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

  if (options?.category && options.category !== "all") {
    url.searchParams.set("category", options.category);
  }
  if (options?.review_status && options.review_status !== "all") {
    url.searchParams.set("review_status", options.review_status);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new GraphClientError(
      body?.error?.message || "Failed to load project dependency graph.",
      body?.error?.code || "GRAPH_LOAD_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as DependencyGraphResponse;
}

export async function clientGetNodeSubgraph(
  projectId: string,
  nodeId: string,
  depth = 2
): Promise<SubgraphResponse> {
  const url = new URL(
    `/api/projects/${projectId}/dependencies/subgraph/${nodeId}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );
  url.searchParams.set("depth", String(depth));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new GraphClientError(
      body?.error?.message || "Failed to load node subgraph.",
      body?.error?.code || "SUBGRAPH_LOAD_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as SubgraphResponse;
}

export async function clientSyncNeo4j(
  projectId: string
): Promise<Neo4jSyncResponse> {
  const res = await fetch(`/api/projects/${projectId}/dependencies/sync-neo4j`, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new GraphClientError(
      body?.error?.message || "Failed to trigger Neo4j sync.",
      body?.error?.code || "NEO4J_SYNC_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as Neo4jSyncResponse;
}
