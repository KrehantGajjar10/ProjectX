"use client";

import * as React from "react";
import type { ProjectDetailRead } from "@/types/project";
import { canEditProjectSettings } from "../lib/settings-utils";
import { clientUpdateProject, SettingsClientError } from "../lib/settings-client";
import { Button } from "@/components/ui/button";
import {
  FolderGit2,
  Info,
  Loader2,
  Lock,
  Save,
} from "lucide-react";

interface GeneralSettingsCardProps {
  project: ProjectDetailRead;
  onProjectUpdated: (updatedProject: ProjectDetailRead) => void;
  onSetFeedback: (msg: { type: "success" | "error"; text: string } | null) => void;
}

export function GeneralSettingsCard({
  project,
  onProjectUpdated,
  onSetFeedback,
}: GeneralSettingsCardProps) {
  const isEditable = canEditProjectSettings(project.my_role);

  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [prevProjectKey, setPrevProjectKey] = React.useState(`${project.id}-${project.updated_at}`);
  const currentProjectKey = `${project.id}-${project.updated_at}`;
  if (currentProjectKey !== prevProjectKey) {
    setPrevProjectKey(currentProjectKey);
    setName(project.name);
    setDescription(project.description || "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    if (!name.trim()) {
      setError("Project name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await clientUpdateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
      });

      onProjectUpdated({
        ...project,
        name: updated.name,
        description: updated.description,
        updated_at: updated.updated_at,
      });

      onSetFeedback({
        type: "success",
        text: "Project details updated successfully.",
      });
    } catch (err) {
      if (err instanceof SettingsClientError) {
        setError(err.message);
      } else {
        setError("Failed to save project settings.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formattedCreatedDate = new Date(project.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-6">
      <div className="flex items-start justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderGit2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              General Project Information
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure project identity, description, and metadata.
            </p>
          </div>
        </div>

        {!isEditable && (
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Read-Only View</span>
          </div>
        )}
      </div>

      {!isEditable && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface/50 p-3.5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <p className="leading-relaxed">
            You are currently viewing this project with <strong>{project.my_role || "viewer"}</strong> permissions. Only Project Admins and Owners can edit project identity and settings.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Project Name */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Project Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditable || isSaving}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
        </div>

        {/* Project Description */}
        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">
            Project Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isEditable || isSaving}
            placeholder="Brief engineering summary or architectural scope..."
            className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive font-medium">
            {error}
          </p>
        )}

        {/* Metadata Details */}
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4 space-y-2 font-mono text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Project Identifier (UUID):</span>
            <span className="text-foreground select-all">{project.id}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Creation Date:</span>
            <span className="text-foreground">{formattedCreatedDate}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Your Project Role:</span>
            <span className="uppercase font-semibold text-primary">{project.my_role || "viewer"}</span>
          </div>
        </div>

        {/* Submit Button */}
        {isEditable && (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
