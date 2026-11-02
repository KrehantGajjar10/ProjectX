import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardHighlights } from "@/types/project";
import {
  AlertOctagon,
  Ban,
  CheckCircle,
  Clock,
  Compass,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

interface ProjectHighlightsProps {
  highlights: DashboardHighlights;
}

export function ProjectHighlights({ highlights }: ProjectHighlightsProps) {
  const { blocked_tasks, critical_risks, recent_decisions } = highlights;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 1. Blocked Tasks */}
      <Card className="border-border/80 bg-card shadow-xs flex flex-col">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <Ban className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Blocked Tasks
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {blocked_tasks.length}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 space-y-3">
          {blocked_tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-primary/70">
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                No blocked tasks
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                All engineering work streams are proceeding without reported blockers.
              </p>
            </div>
          ) : (
            blocked_tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border/80 bg-surface/50 p-3 space-y-1.5 transition-colors hover:border-destructive/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-medium text-foreground line-clamp-1">
                    {task.title}
                  </h4>
                  <Badge variant="destructive" className="text-[9px] uppercase px-1 py-0">
                    {task.priority || "Blocked"}
                  </Badge>
                </div>
                {task.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                {task.due_date && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-mono">
                    <Clock className="h-3 w-3" />
                    Due {task.due_date}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 2. Critical Risks */}
      <Card className="border-border/80 bg-card shadow-xs flex flex-col">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-copper/10 text-copper">
                <AlertOctagon className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Critical Risks
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {critical_risks.length}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 space-y-3">
          {critical_risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-emerald">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                No critical risks
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                System architectural indicators are within safe parameters.
              </p>
            </div>
          ) : (
            critical_risks.map((risk) => (
              <div
                key={risk.id}
                className="rounded-lg border border-border/80 bg-surface/50 p-3 space-y-1.5 transition-colors hover:border-copper/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-medium text-foreground line-clamp-1">
                    {risk.title}
                  </h4>
                  <Badge variant="copper" className="text-[9px] uppercase px-1 py-0">
                    {risk.severity}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {risk.description || risk.rationale}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{risk.category}</span>
                  <span>Confidence: {(risk.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 3. Recent Decisions */}
      <Card className="border-border/80 bg-card shadow-xs flex flex-col">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet/10 text-violet">
                <Compass className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Recent Decisions
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {recent_decisions.length}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 space-y-3">
          {recent_decisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-violet">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                No decisions captured yet
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Decisions and rationale will appear here as team activity and sources are processed.
              </p>
            </div>
          ) : (
            recent_decisions.map((dec) => (
              <div
                key={dec.id}
                className="rounded-lg border border-border/80 bg-surface/50 p-3 space-y-1.5 transition-colors hover:border-violet/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-medium text-foreground line-clamp-1">
                    {dec.title}
                  </h4>
                  <Badge variant="violet" className="text-[9px] uppercase px-1 py-0">
                    {dec.review_status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {dec.description}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{dec.category}</span>
                  <span>Confidence: {(dec.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
