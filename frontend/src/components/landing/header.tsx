"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X, ArrowUpRight, ArrowRight, Compass } from "lucide-react";

const NAV_ITEMS = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "Workflow", href: "#workflow" },
  { label: "Evidence & Trust", href: "#trust" },
  { label: "About", href: "#about" },
];

interface HeaderProps {
  isAuthenticated?: boolean;
}

export function Header({ isAuthenticated = false }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
      <Container className="flex h-14 items-center justify-between">
        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-tight shadow-xs transition-transform group-hover:scale-105">
            PX
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              ProjectX
              <span className="hidden sm:inline-flex rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                v1.0
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 transition-colors hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Actions: Theme Toggle, Auth & Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {isAuthenticated ? (
            <Link
              href="/app"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "hidden sm:inline-flex text-xs font-semibold gap-1.5 shadow-2xs"
              )}
            >
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "hidden sm:inline-flex text-xs font-medium"
                )}
              >
                Sign In
              </Link>

              <a
                href="#workflow"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden sm:inline-flex gap-1.5 font-medium"
                )}
              >
                Explore Workflow
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </Container>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 py-4 shadow-lg animate-in fade-in-50 slide-in-from-top-2 duration-150">
          <Container className="space-y-3 px-0">
            <nav className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {item.label}
                  <Compass className="h-3.5 w-3.5 opacity-50" />
                </a>
              ))}
            </nav>

            <div className="pt-2 border-t border-border flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/app"
                  onClick={closeMobileMenu}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "w-full justify-center text-xs gap-1.5 font-semibold"
                  )}
                >
                  Go to Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full justify-center text-xs"
                    )}
                  >
                    Sign In
                  </Link>
                  <a
                    href="#workflow"
                    onClick={closeMobileMenu}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "w-full justify-center gap-1.5"
                    )}
                  >
                    Explore Workflow
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
