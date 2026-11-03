"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ProjectRole } from "@/types/project";
import { canDeleteProject } from "../lib/settings-utils";
import { clientDeleteProject, SettingsClientError } from "../lib/settings-client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Loader2,
  Lock,
  Trash2,
  X,
} from "lucide-react";

interface ProjectDangerZoneProps {
  projectId: string;
  projectName: string;
  myRole?: ProjectRole | null;
}

export function ProjectDangerZone({
  projectId,
  projectName,
  myRole,
}: ProjectDangerZoneProps) {
  const router = useRouter();
  const isOwner = canDeleteProject(myRole);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [typedName, setTypedName] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || typedName !== projectName) return;

    setIsDeleting(true);
    setError(null);

    try {
      await clientDeleteProject(projectId);
      router.push("/app/projects");
    } catch (err) {
      if (err instanceof SettingsClientError) {
        setError(err.message);
      } else {
        setError("Failed to delete project. Please check your network or permissions.");
      }
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-destructive/40 bg-card p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-destructive/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-destructive">
              Danger Zone
            </h2>
            {!isOwner && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground border border-border bg-surface px-2 py-0.5 rounded-full">
                <Lock className="h-3 w-3" />
                Owner Only
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Irreversible operations and project decommissioning.
          </p>
        </div>

        {isOwner ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setTypedName("");
              setError(null);
              setIsModalOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete This Project
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Only the Project Owner can delete this repository.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Deleting this project permanently erases all associated knowledge claims, ingestion documents, extracted dependency graphs, risk radar signals, and handover reports. This operation cannot be undone.
      </p>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setIsModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-dialog-title"
            className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200 text-xs"
          >
            <div className="flex items-start justify-between pb-2 border-b border-border/70">
              <div className="flex items-center gap-2.5 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h3
                  id="delete-project-dialog-title"
                  className="text-base font-bold"
                >
                  Confirm Project Deletion
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isDeleting}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              This action <strong>CANNOT</strong> be undone. To verify, please type the exact project name:{" "}
              <strong className="text-foreground select-all">{projectName}</strong>
            </p>

            <form onSubmit={handleDelete} className="space-y-4">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={projectName}
                disabled={isDeleting}
                className="w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs text-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
              />

              {error && (
                <p className="text-xs text-destructive font-medium">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="destructive"
                  disabled={typedName !== projectName || isDeleting}
                  className="gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Permanently Delete"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
