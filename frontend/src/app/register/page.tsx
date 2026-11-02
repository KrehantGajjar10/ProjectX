import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-auth";
import { RegisterForm } from "@/components/auth/register-form";

export const instant = false;

export const metadata = {
  title: "Register",
  description: "Create your ProjectX workspace account.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-3 sm:p-4 bg-background">
      <RegisterForm />
    </main>
  );
}
