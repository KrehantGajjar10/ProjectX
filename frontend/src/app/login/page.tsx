import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/server-auth";
import { LoginForm } from "@/components/auth/login-form";

export const instant = false;

export const metadata = {
  title: "Sign In",
  description: "Sign in to your ProjectX workspace.",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-3 sm:p-4 bg-background">
      <Suspense
        fallback={
          <div className="h-96 w-full max-w-sm rounded-xl border border-border bg-card/60 animate-pulse" />
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
