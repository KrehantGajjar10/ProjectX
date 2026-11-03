import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  HandoverReportVersionSummary,
  LatestHandoverResponse,
} from "../types/handover";

export async function serverGetLatestHandover(
  projectId: string
): Promise<LatestHandoverResponse | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/handover`);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverGetLatestHandover] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: LatestHandoverResponse = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetLatestHandover] Network failure:", err);
    return null;
  }
}

export async function serverListHandoverVersions(
  projectId: string
): Promise<HandoverReportVersionSummary[]> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return [];
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/handover/versions`);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverListHandoverVersions] Backend responded with HTTP ${res.status}`
      );
      return [];
    }

    const data: HandoverReportVersionSummary[] = await res.json();
    return data;
  } catch (err) {
    console.error("[serverListHandoverVersions] Network failure:", err);
    return [];
  }
}
