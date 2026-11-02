import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/server-auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/landing/container";
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

export const instant = false;

export const metadata = {
  title: "Workspace Session",
  description: "Authenticated ProjectX session verification.",
};

export default async function AppPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?returnUrl=/app");
  }

  const formattedDate = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      {/* Top Application Bar */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <Container className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-tight shadow-xs">
                PX
              </div>
              <span className="font-semibold tracking-tight text-sm">
                ProjectX
              </span>
            </Link>
            <span className="hidden sm:inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Authenticated Session
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </Container>
      </header>

      {/* Main Verification Canvas */}
      <main className="flex-1 py-10 sm:py-12">
        <Container className="space-y-8 max-w-4xl">
          {/* Welcome Banner */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Protected Access Verified
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {user.full_name || user.email.split("@")[0]}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your server-side authentication session has been verified against the FastAPI backend via HTTP-only cookie.
            </p>
          </div>

          {/* User Profile Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Authenticated Profile
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live profile fetched from FastAPI <code className="font-mono">GET /auth/me</code>
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="emerald" className="gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" />
                    Active Account
                  </Badge>
                  {user.is_superuser && (
                    <Badge variant="violet" className="text-[11px]">
                      Superuser
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 rounded-lg border border-border/70 bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Email Address
                  </div>
                  <div className="font-mono text-sm font-medium text-foreground">
                    {user.email}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border/70 bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Display Name
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {user.full_name || <span className="italic text-muted-foreground">Not provided</span>}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border/70 bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Account User ID (UUID)
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate select-all">
                    {user.id}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border/70 bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Member Since
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {formattedDate}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chapter 4 Workspace Roadmap Notice */}
          <div className="rounded-xl border border-border/80 bg-surface/60 p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              Chapter 3 Milestone Complete
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In Chapter 4, this verification view will be replaced by the complete Project Workspace (project creation, tenant selection, team memberships, and RBAC permissions).
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}
