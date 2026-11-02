import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ShieldAlert, Sparkles, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-sm shadow-xs">
              PX
            </div>
            <span className="font-semibold tracking-tight text-foreground text-sm">
              ProjectX
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Foundation
            </span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Verification Canvas */}
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-10">
          {/* Identity Header */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Obsidian & Emerald Design System
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              ProjectX
            </h1>
            <p className="text-base text-muted-foreground max-w-xl">
              Capture. Understand. Handover.
            </p>
          </div>

          {/* Color Tokens Palette Verification */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Color Token Verification
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-xs">
                <div className="h-9 w-full rounded-md bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                  Primary
                </div>
                <div className="text-xs font-medium text-foreground">Emerald</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  #10B981 / #087A55
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-xs">
                <div className="h-9 w-full rounded-md bg-copper flex items-center justify-center text-xs font-medium text-copper-foreground">
                  Secondary
                </div>
                <div className="text-xs font-medium text-foreground">Copper</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  #D97736 / #C25E1A
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-xs">
                <div className="h-9 w-full rounded-md bg-violet flex items-center justify-center text-xs font-medium text-violet-foreground">
                  Secondary
                </div>
                <div className="text-xs font-medium text-foreground">Violet</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  #8B5CF6 / #7C3AED
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-xs">
                <div className="h-9 w-full rounded-md bg-surface border border-border flex items-center justify-center text-xs font-medium text-foreground">
                  Surface
                </div>
                <div className="text-xs font-medium text-foreground">Obsidian Base</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  #09090B / #FFFFFF
                </div>
              </div>
            </div>
          </section>

          {/* Component Primitives Verification */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. Core Foundation Primitives
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Evidence-Linked Card Sample */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Architecture Decision #01</CardTitle>
                    <Badge variant="emerald" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Verified Excerpt
                    </Badge>
                  </div>
                  <CardDescription>
                    PostgreSQL 17 for Relational Persistence & CTE Traversals
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground font-mono bg-surface p-2.5 rounded-md border border-border">
                    &quot;We selected PostgreSQL 17 with asyncpg as the primary relational system of record.&quot;
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="copper">High Priority</Badge>
                    <Badge variant="violet">Graph DAG</Badge>
                    <Badge variant="outline">docs/ARCHITECTURE.md#L45</Badge>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground font-mono">
                    Provenance: SHA-256
                  </span>
                  <Button size="sm" variant="default">
                    Inspect Evidence
                  </Button>
                </CardFooter>
              </Card>

              {/* Action Buttons & Badges Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle>Action Variants & States</CardTitle>
                  <CardDescription>
                    High-contrast buttons, badges, and status tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="default">Primary Emerald</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="copper">Copper Accent</Button>
                    <Button variant="violet">Violet Accent</Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Badge variant="default">Default</Badge>
                    <Badge variant="secondary">Pending Review</Badge>
                    <Badge variant="emerald">Verified [98%]</Badge>
                    <Badge variant="copper">SPOK Alert</Badge>
                    <Badge variant="violet">Inference</Badge>
                    <Badge variant="destructive">
                      <ShieldAlert className="mr-1 h-3 w-3 inline" /> Blocked
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    Chapter 1 Foundation Verification Complete
                  </div>
                </CardFooter>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
