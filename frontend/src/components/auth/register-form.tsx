"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { registerClient, AuthClientError } from "@/lib/auth-client";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerClient({
        email: cleanEmail,
        password,
        full_name: fullName.trim() || undefined,
      });

      setSuccessMessage(
        res.message || "Account created successfully! Redirecting to login..."
      );

      // Give the user time to read the confirmation before redirecting
      setTimeout(() => {
        router.push("/login?registered=true");
      }, 1500);
    } catch (err) {
      if (err instanceof AuthClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred during registration.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      {/* Top Header Toolbar */}
      <div className="flex items-center justify-between pb-2">
        <Link
          href="/"
          className="flex items-center gap-2 group text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-tight shadow-xs transition-transform group-hover:scale-105">
            PX
          </div>
          <span className="font-semibold text-sm tracking-tight">ProjectX</span>
        </Link>

        <ThemeToggle />
      </div>

      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Create an account
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Get started with evidence-grounded project handover and knowledge tracking.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3.5">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50 duration-150"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-primary animate-in fade-in-50 duration-150"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="reg-name">Full name (optional)</Label>
              <Input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="Dave Miller"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading || Boolean(successMessage)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="reg-email" isRequired>
                Work email
              </Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || Boolean(successMessage)}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="reg-password" isRequired>
                Password (min. 8 characters)
              </Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || Boolean(successMessage)}
                  required
                  minLength={8}
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="reg-confirm" isRequired>
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="reg-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || Boolean(successMessage)}
                  required
                  minLength={8}
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 font-medium"
              disabled={isLoading || Boolean(successMessage)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
