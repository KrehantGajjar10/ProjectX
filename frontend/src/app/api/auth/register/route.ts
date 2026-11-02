import { NextResponse } from "next/server";
import { getApiBaseUrl, parseBackendError } from "@/lib/server-auth";
import type { UserRead } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Invalid registration payload.",
          },
        },
        { status: 400 }
      );
    }

    const { email, password, full_name } = body;

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

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Password must be at least 8 characters long.",
          },
        },
        { status: 422 }
      );
    }

    const apiBase = getApiBaseUrl();

    let regResponse: Response;
    try {
      regResponse = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: typeof full_name === "string" && full_name.trim() ? full_name.trim() : null,
        }),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "ProjectX registration service is unreachable. Please verify backend is running.",
          },
        },
        { status: 503 }
      );
    }

    const regData = await regResponse.json().catch(() => null);

    if (!regResponse.ok) {
      const error = parseBackendError(
        regResponse.status,
        regData,
        "Registration failed."
      );
      return NextResponse.json(
        { success: false, error },
        { status: regResponse.status }
      );
    }

    const user = regData as UserRead;

    return NextResponse.json(
      {
        success: true,
        user,
        message: "Registration successful. You can now log in.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/auth/register] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during registration.",
        },
      },
      { status: 500 }
    );
  }
}
