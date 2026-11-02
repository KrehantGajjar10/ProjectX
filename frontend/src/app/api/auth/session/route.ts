import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  getAuthTokenFromCookies,
  getCurrentUser,
} from "@/lib/server-auth";

export async function GET() {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 401 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    // Cookie is invalid or expired; purge it
    const cookieStore = await cookies();
    cookieStore.delete({
      name: AUTH_COOKIE_NAME,
      path: "/",
    });

    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user,
    },
    { status: 200 }
  );
}
