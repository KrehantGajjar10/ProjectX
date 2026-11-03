"use client";

import * as React from "react";
import type { ProjectMemberRead, ProjectRole } from "@/types/project";
import {
  canAssignOwnerRole,
  canManageMembers,
  getRoleBadgeClass,
} from "../lib/settings-utils";
import {
  clientAddMember,
  clientRemoveMember,
  clientUpdateMemberRole,
  SettingsClientError,
} from "../lib/settings-client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

interface MembersSettingsCardProps {
  projectId: string;
  myRole?: ProjectRole | null;
  initialMembers: ProjectMemberRead[];
  onSetFeedback: (msg: { type: "success" | "error"; text: string } | null) => void;
}

export function MembersSettingsCard({
  projectId,
  myRole,
  initialMembers,
  onSetFeedback,
}: MembersSettingsCardProps) {
  const isManager = canManageMembers(myRole);
  const isOwner = canAssignOwnerRole(myRole);

  const [members, setMembers] = React.useState<ProjectMemberRead[]>(initialMembers);

  // Add Member Modal State
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [addEmail, setAddEmail] = React.useState("");
  const [addRole, setAddRole] = React.useState<ProjectRole>("member");
  const [isAdding, setIsAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  // Remove Member Dialog State
  const [memberToRemove, setMemberToRemove] = React.useState<ProjectMemberRead | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  // Updating role member id
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const newMember = await clientAddMember(projectId, {
        email: addEmail.trim(),
        role: addRole,
      });

      setMembers((prev) => [...prev, newMember]);
      setIsAddOpen(false);
      setAddEmail("");
      setAddRole("member");
      onSetFeedback({
        type: "success",
        text: `Member '${addEmail.trim()}' added with role ${addRole}.`,
      });
    } catch (err) {
      if (err instanceof SettingsClientError) {
        setAddError(err.message);
      } else {
        setAddError("Failed to add member. Ensure the user exists in ProjectX.");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    setUpdatingMemberId(memberId);

    try {
      const updated = await clientUpdateMemberRole(projectId, memberId, {
        role: newRole,
      });

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: updated.role } : m))
      );
      onSetFeedback({
        type: "success",
        text: `Updated role to ${newRole}.`,
      });
    } catch (err) {
      if (err instanceof SettingsClientError) {
        onSetFeedback({ type: "error", text: err.message });
      } else {
        onSetFeedback({
          type: "error",
          text: "Failed to update member role.",
        });
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);

    try {
      await clientRemoveMember(projectId, memberToRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      onSetFeedback({
        type: "success",
        text: `Removed member ${memberToRemove.user?.email || memberToRemove.id}.`,
      });
      setMemberToRemove(null);
    } catch (err) {
      if (err instanceof SettingsClientError) {
        onSetFeedback({ type: "error", text: err.message });
      } else {
        onSetFeedback({
          type: "error",
          text: "Failed to remove member.",
        });
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Team Members & Role Governance
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage project collaborators, role assignments, and review authorizations.
            </p>
          </div>
        </div>

        {isManager && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAddError(null);
              setIsAddOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Members List */}
      <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
        {members.map((member) => {
          const userName = member.user?.full_name || "Team Member";
          const userEmail = member.user?.email || "Unknown email";
          const initials = userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          const isTargetOwner = member.role === "owner";
          const canModifyThisMember =
            isManager && (!isTargetOwner || isOwner);

          const formattedJoined = new Date(member.created_at).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          );

          return (
            <div
              key={member.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs"
            >
              {/* Member Info */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border font-mono text-xs font-bold text-foreground">
                  {initials}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {userName}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.2 text-[10px] font-mono uppercase tracking-wider ${getRoleBadgeClass(
                        member.role
                      )}`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                    <span className="font-mono">{userEmail}</span>
                    <span>•</span>
                    <span>Joined {formattedJoined}</span>
                  </div>
                </div>
              </div>

              {/* Actions / Role Controls */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {canModifyThisMember ? (
                  <>
                    <select
                      value={member.role}
                      disabled={updatingMemberId === member.id}
                      onChange={(e) =>
                        handleUpdateRole(member.id, e.target.value as ProjectRole)
                      }
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-medium"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="admin">Admin</option>
                      {isOwner && <option value="owner">Owner</option>}
                    </select>

                    <button
                      type="button"
                      onClick={() => setMemberToRemove(member)}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                      title="Remove member"
                      aria-label={`Remove ${userName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic font-mono">
                    {isTargetOwner ? "Protected Owner" : "Managed Role"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal Dialog */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isAdding) setIsAddOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-member-dialog-title"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200 text-xs"
          >
            <div className="flex items-start justify-between pb-2 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    id="add-member-dialog-title"
                    className="text-base font-bold text-foreground"
                  >
                    Add Team Member
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Add an existing registered ProjectX user by email.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={isAdding}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 pt-1">
              {/* User Email */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  User Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  required
                  disabled={isAdding}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Project Role <span className="text-destructive">*</span>
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as ProjectRole)}
                  disabled={isAdding}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="viewer">Viewer (Read-only access)</option>
                  <option value="member">Member (Generate reports & tasks)</option>
                  <option value="reviewer">Reviewer (Approve & governance)</option>
                  <option value="admin">Admin (Manage members & settings)</option>
                  {isOwner && <option value="owner">Owner (Full sovereignty)</option>}
                </select>
              </div>

              {addError && (
                <p className="text-xs text-destructive font-medium">
                  {addError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isAdding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAdding}
                  className="gap-1.5"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Member"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isRemoving) setMemberToRemove(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-dialog-title"
            className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200 text-xs"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3
                  id="remove-member-dialog-title"
                  className="text-base font-bold text-foreground"
                >
                  Remove Team Member
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove{" "}
                  <strong>
                    {memberToRemove.user?.full_name || memberToRemove.user?.email}
                  </strong>{" "}
                  from this project? They will immediately lose access to all project resources.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="gap-1.5"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Confirm Removal"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
