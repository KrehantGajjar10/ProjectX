"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectClient } from "@/lib/projects-client";
import { AuthClientError } from "@/lib/auth-client";
import { AlertCircle, FolderPlus, Loader2, X } from "lucide-react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onProjectCreated,
}: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleClose = React.useCallback(() => {
    setName("");
    setDescription("");
    setErrorMessage(null);
    setIsLoading(false);
    onClose();
  }, [onClose]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage("Project name is required.");
      return;
    }

    if (cleanName.length > 255) {
      setErrorMessage("Project name cannot exceed 255 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const created = await createProjectClient({
        name: cleanName,
        description: description.trim() || undefined,
      });

      onClose();
      if (onProjectCreated) {
        onProjectCreated();
      }
      router.push(`/app/projects/${created.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof AuthClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred while creating the project.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-150"
    >
      {/* Backdrop click */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (!isLoading) handleClose();
        }}
      />

      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-foreground tracking-tight">
                Create New Project
              </h2>
              <p className="text-xs text-muted-foreground">
                Set up an evidence-grounded project workspace.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50 duration-150"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="proj-name" isRequired>
              Project Name
            </Label>
            <Input
              id="proj-name"
              type="text"
              placeholder="e.g. Chronos Workflow Engine"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              maxLength={255}
              required
              autoFocus
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description (optional)</Label>
            <textarea
              id="proj-desc"
              rows={3}
              placeholder="Brief summary of the architecture and team goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              size="sm"
              className="gap-1.5 font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
