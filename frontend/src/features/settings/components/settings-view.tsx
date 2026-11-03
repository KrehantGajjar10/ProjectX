"use client";

import * as React from "react";
import type { ProjectDetailRead } from "@/types/project";
import { getRoleBadgeClass } from "../lib/settings-utils";
import { GeneralSettingsCard } from "./general-settings-card";
import { MembersSettingsCard } from "./members-settings-card";
import { ProjectDangerZone } from "./project-danger-zone";
import {
  AlertCircle,
  CheckCircle2,
  FolderGit2,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";

interface SettingsViewProps {
  project: ProjectDetailRead;
}

export function SettingsView({ project }: SettingsViewProps) {
  const [currentProject, setCurrentProject] = React.useState<ProjectDetailRead>(project);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [activeTab, setActiveTab] = React.useState<"general" | "members" | "danger">("general");

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Project Settings
                </h1>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${getRoleBadgeClass(
                    currentProject.my_role
                  )}`}
                >
                  {currentProject.my_role || "viewer"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage project identity, team roles, governance permissions, and repository configuration.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "general"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            General
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "members"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Team Members ({currentProject.members?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("danger")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "danger"
                ? "bg-destructive text-destructive-foreground shadow-2xs"
                : "bg-surface text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            Danger Zone
          </button>
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-xs transition-colors ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            )}
            <span className="leading-relaxed font-medium">
              {feedback.text}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Content for Tabs */}
      {activeTab === "general" && (
        <GeneralSettingsCard
          project={currentProject}
          onProjectUpdated={setCurrentProject}
          onSetFeedback={setFeedback}
        />
      )}

      {activeTab === "members" && (
        <MembersSettingsCard
          projectId={currentProject.id}
          myRole={currentProject.my_role}
          initialMembers={currentProject.members || []}
          onSetFeedback={setFeedback}
        />
      )}

      {activeTab === "danger" && (
        <ProjectDangerZone
          projectId={currentProject.id}
          projectName={currentProject.name}
          myRole={currentProject.my_role}
        />
      )}
    </div>
  );
}
