import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/server-auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: AUTH_COOKIE_NAME,
    path: "/",
  });

  return NextResponse.json(
    {
      success: true,
      message: "Logged out successfully.",
    },
    { status: 200 }
  );
}
