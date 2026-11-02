import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  getApiBaseUrl,
  getAuthCookieOptions,
  parseBackendError,
} from "@/lib/server-auth";
import type { BackendToken, UserRead } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Invalid request payload. Please supply email and password.",
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Email and password are required.",
          },
        },
        { status: 422 }
      );
    }

    const apiBase = getApiBaseUrl();

    // 1. Authenticate against FastAPI
    let loginResponse: Response;
    try {
      loginResponse = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "ProjectX authentication service is unreachable. Please verify backend is running.",
          },
        },
        { status: 503 }
      );
    }

    const loginData = await loginResponse.json().catch(() => null);

    if (!loginResponse.ok) {
      const error = parseBackendError(
        loginResponse.status,
        loginData,
        "Authentication failed."
      );
      return NextResponse.json(
        { success: false, error },
        { status: loginResponse.status }
      );
    }

    const tokenData = loginData as BackendToken;
    if (!tokenData?.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Backend response missing access token.",
          },
        },
        { status: 500 }
      );
    }

    // 2. Fetch authenticated user profile using token
    let meResponse: Response;
    try {
      meResponse = await fetch(`${apiBase}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Failed to verify session with backend profile service.",
          },
        },
        { status: 503 }
      );
    }

    const meData = await meResponse.json().catch(() => null);

    if (!meResponse.ok) {
      const error = parseBackendError(
        meResponse.status,
        meData,
        "Unable to fetch user profile."
      );
      return NextResponse.json(
        { success: false, error },
        { status: meResponse.status }
      );
    }

    const user = meData as UserRead;

    // 3. Set HTTP-only secure cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, tokenData.access_token, getAuthCookieOptions());

    // 4. Return safe user data without exposing access_token
    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/auth/login] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during login.",
        },
      },
      { status: 500 }
    );
  }
}
