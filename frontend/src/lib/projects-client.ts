import type { ProjectRead } from "@/types/project";
import { AuthClientError } from "@/lib/auth-client";

export async function createProjectClient(payload: {
  name: string;
  description?: string;
}): Promise<ProjectRead> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new AuthClientError(
      data?.error?.code || "CREATE_PROJECT_FAILED",
      data?.error?.message || "Failed to create project.",
      data?.error?.details
    );
  }

  return data.project as ProjectRead;
}
