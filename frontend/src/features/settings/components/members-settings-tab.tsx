import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  Info,
  MoreVertical,
  Trash2,
  Copy,
  Check,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useMembers,
  useUpdateMemberRole,
  useRemoveMember,
} from "../hooks/use-members";
import {
  usePendingInvitations,
  useRevokeInvitation,
} from "../hooks/use-invitations";
import type { MemberItem } from "../schemas/member-schemas";
import type { PendingInvitationItem } from "../schemas/invitation-schemas";
import { InviteMemberDialog } from "./invite-member-dialog";

export function MembersSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<PendingInvitationItem | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [mountedTime] = useState(() => Date.now());

  const {
    data: members = [],
    isLoading: isMembersLoading,
    error: membersError,
  } = useMembers();

  const {
    data: pendingInvitations = [],
    isLoading: isInvitationsLoading,
  } = usePendingInvitations(user?.tenant.id ?? "");

  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const revokeInvitationMutation = useRevokeInvitation(user?.tenant.id ?? "");

  if (!user) return null;

  const userRole = user.membership.role;
  const canManage = userRole === "OWNER" || userRole === "ADMIN";

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "OWNER":
        return (
          <Badge variant="default" className="gap-1 bg-accent text-accent-fg">
            <ShieldAlert className="size-3" aria-hidden="true" />
            <span>{t("auth.roleOwner")}</span>
          </Badge>
        );
      case "ADMIN":
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-accent-soft text-accent border-accent/20"
          >
            <ShieldCheck className="size-3" aria-hidden="true" />
            <span>{t("auth.roleAdmin")}</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-fg-muted">
            <User className="size-3" aria-hidden="true" />
            <span>{t("auth.roleMember")}</span>
          </Badge>
        );
    }
  };

  const handleCopyInviteLink = async (invitation: PendingInvitationItem) => {
    try {
      const link = `${window.location.origin}/invitations/${invitation.token}`;
      await navigator.clipboard.writeText(link);
      setCopiedTokenId(invitation.id);
      setTimeout(() => setCopiedTokenId(null), 2500);
    } catch {
      // Clipboard fallback
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync(memberToRemove.id);
      setMemberToRemove(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleConfirmRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    try {
      await revokeInvitationMutation.mutateAsync(invitationToRevoke.id);
      setInvitationToRevoke(null);
    } catch {
      // Error handled by mutation
    }
  };

  const calculateDaysRemaining = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - mountedTime;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return t("settings.expiresToday");
    return t("settings.expiresInDays", { days });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg tracking-tight">
            {t("settings.membersTitle", { defaultValue: "Thành viên tổ chức" })}
          </h2>
          <p className="text-sm text-fg-muted mt-0.5">
            {t("settings.membersSubtitle", {
              defaultValue:
                "Quản lý nhân sự và quyền truy cập vào không gian làm việc của bạn.",
            })}
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="default"
            onClick={() => setInviteDialogOpen(true)}
            className="gap-2 shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            <span>{t("settings.inviteMemberButton")}</span>
          </Button>
        )}
      </div>

      {!canManage && (
        <div
          role="note"
          className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-muted/50 text-sm text-fg-muted"
        >
          <Info className="size-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <p>{t("settings.memberOnlyNotice")}</p>
        </div>
      )}

      {/* Grid: Workspace Info & Current Account */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Workspace Card */}
        <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Building2 className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">
                {t("settings.workspaceInfo")}
              </h3>
              <p className="text-xs text-fg-muted font-mono">
                {user.tenant.slug || "workspace"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-fg-muted block mb-0.5">
                {t("settings.workspaceName")}
              </span>
              <span className="font-medium text-fg truncate block">
                {user.tenant.name}
              </span>
            </div>
            <div>
              <span className="text-xs text-fg-muted block mb-0.5">
                {t("settings.currentPlan")}
              </span>
              <Badge variant="secondary" className="font-mono text-xs uppercase">
                {user.tenant.plan}
              </Badge>
            </div>
          </div>
        </div>

        {/* Current Account Card */}
        <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <div className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">
                {t("settings.currentUserInfo")}
              </h3>
              <p className="text-xs text-fg-muted truncate max-w-48 sm:max-w-xs">
                {user.identity.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-fg-muted block mb-1">
                {t("settings.yourRole")}
              </span>
              {getRoleBadge(userRole)}
            </div>
            <div>
              <span className="text-xs text-fg-muted block mb-1">
                {t("settings.yourStatus")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {user.membership.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Members Section */}
      <section className="space-y-3" aria-labelledby="active-members-heading">
        <div className="flex items-center justify-between">
          <div>
            <h3
              id="active-members-heading"
              className="text-sm font-semibold text-fg flex items-center gap-2"
            >
              <User className="size-4 text-accent" aria-hidden="true" />
              <span>
                {t("settings.activeMembersTitle", { count: members.length })}
              </span>
            </h3>
            <p className="text-xs text-fg-muted mt-0.5">
              {t("settings.activeMembersSubtitle")}
            </p>
          </div>
        </div>

        {isMembersLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : membersError ? (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive">
            {t("common.error")}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs divide-y divide-border">
            {members.map((member) => {
              const isCurrentUser = member.identityId === user.identity.id;
              const isOwner = member.role === "OWNER";
              const canEditThisMember =
                canManage &&
                !isCurrentUser &&
                !(userRole === "ADMIN" && (member.role === "ADMIN" || isOwner)) &&
                !(isOwner && userRole !== "OWNER");

              const displayName = member.displayName || member.email.split("@")[0];
              const initial = (member.displayName || member.email)[0].toUpperCase();

              return (
                <div
                  key={member.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-sm font-semibold">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg truncate">
                          {displayName}
                        </span>
                        {isCurrentUser && (
                          <Badge
                            variant="outline"
                            className="text-2xs py-0 px-1.5 border-accent/30 text-accent bg-accent/5"
                          >
                            {t("settings.youBadge")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-fg-muted truncate block">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <div className="text-right hidden md:block">
                      <span className="text-xs text-fg-muted block">
                        {t("settings.joinedDate", {
                          date: new Date(member.joinedAt).toLocaleDateString(
                            "vi-VN"
                          ),
                        })}
                      </span>
                    </div>

                    <div className="shrink-0">{getRoleBadge(member.role)}</div>

                    {canEditThisMember && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-fg-muted hover:text-fg"
                              aria-label={t("settings.changeRole")}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-48">
                          {member.role !== "ADMIN" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: "ADMIN",
                                })
                              }
                            >
                              <ShieldCheck className="size-4 mr-2 text-accent" />
                              <span>{t("settings.setAsAdmin")}</span>
                            </DropdownMenuItem>
                          )}
                          {member.role !== "MEMBER" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: "MEMBER",
                                })
                              }
                            >
                              <User className="size-4 mr-2 text-fg-muted" />
                              <span>{t("settings.setAsMember")}</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setMemberToRemove(member)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            <span>{t("settings.removeMember")}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Invitations Section (Visible to OWNER & ADMIN) */}
      {canManage && (
        <section
          className="space-y-3 pt-2"
          aria-labelledby="pending-invitations-heading"
        >
          <div>
            <h3
              id="pending-invitations-heading"
              className="text-sm font-semibold text-fg flex items-center gap-2"
            >
              <Clock className="size-4 text-accent" aria-hidden="true" />
              <span>
                {t("settings.pendingInvitationsTitle", {
                  count: pendingInvitations.length,
                })}
              </span>
            </h3>
            <p className="text-xs text-fg-muted mt-0.5">
              {t("settings.pendingInvitationsSubtitle")}
            </p>
          </div>

          {isInvitationsLoading ? (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-border bg-surface/50 text-center">
              <p className="text-xs text-fg-muted">
                {t("settings.noPendingInvitations")}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs divide-y divide-border">
              {pendingInvitations.map((inv) => {
                const isCopied = copiedTokenId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
                        <Mail className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-fg truncate block">
                          {inv.email}
                        </span>
                        <span className="text-xs text-fg-muted flex items-center gap-1.5 mt-0.5">
                          <span>{calculateDaysRemaining(inv.expiresAt)}</span>
                          {inv.invitedByEmail && (
                            <>
                              <span>•</span>
                              <span className="truncate">
                                {inv.invitedByEmail}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                        {inv.role}
                      </Badge>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyInviteLink(inv)}
                        className="gap-1.5 text-xs h-8"
                      >
                        {isCopied ? (
                          <>
                            <Check
                              className="size-3.5 text-success"
                              aria-hidden="true"
                            />
                            <span className="text-success font-medium">
                              {t("settings.copiedInviteLink")}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" aria-hidden="true" />
                            <span>{t("settings.copyInviteLink")}</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setInvitationToRevoke(inv)}
                        className="text-fg-muted hover:text-destructive"
                        aria-label={t("settings.revokeInvite")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Permissions Breakdown Cards */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
          <Shield className="size-4 text-accent" aria-hidden="true" />
          <span>{t("settings.rolePermissionsTitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="size-4 text-accent" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-fg">
                  {t("settings.roleOwnerTitle")}
                </h4>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                {t("settings.roleOwnerDesc")}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-fg">
                  {t("settings.roleAdminTitle")}
                </h4>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                {t("settings.roleAdminDesc")}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <User className="size-4 text-fg-muted" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-fg">
                  {t("settings.roleMemberTitle")}
                </h4>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                {t("settings.roleMemberDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.removeMember")}</DialogTitle>
            <DialogDescription>
              {memberToRemove &&
                t("settings.removeMemberConfirm", {
                  email: memberToRemove.email,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeMemberMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  <span>{t("common.deleting")}</span>
                </>
              ) : (
                <span>{t("settings.removeMember")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Invitation Confirmation Dialog */}
      <Dialog
        open={!!invitationToRevoke}
        onOpenChange={(open) => !open && setInvitationToRevoke(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.revokeInvite")}</DialogTitle>
            <DialogDescription>
              {invitationToRevoke &&
                t("settings.revokeInviteConfirm", {
                  email: invitationToRevoke.email,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvitationToRevoke(null)}
              disabled={revokeInvitationMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevokeInvitation}
              disabled={revokeInvitationMutation.isPending}
            >
              {revokeInvitationMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  <span>{t("common.deleting")}</span>
                </>
              ) : (
                <span>{t("settings.revokeInvite")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      {canManage && (
        <InviteMemberDialog
          tenantId={user.tenant.id}
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />
      )}
    </div>
  );
}
