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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { InviteMemberDialog } from "./invite-member-dialog";

export function MembersSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  if (!user) return null;

  const userRole = user.membership.role;
  const canInvite = userRole === "OWNER" || userRole === "ADMIN";

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
          <Badge variant="secondary" className="gap-1 bg-accent-soft text-accent border-accent/20">
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

  return (
    <div className="space-y-6">
      {/* Header with Title and Invite Button */}
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

        {canInvite && (
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

      {!canInvite && (
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
              <p className="text-xs text-fg-muted">
                {user.tenant.slug || "default-workspace"}
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
              <p className="text-xs text-fg-muted truncate max-w-[200px] sm:max-w-[280px]">
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

      {/* Permissions Breakdown Cards */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
          <Shield className="size-4 text-accent" aria-hidden="true" />
          <span>{t("settings.rolePermissionsTitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Owner Role */}
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

          {/* Admin Role */}
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

          {/* Member Role */}
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

      {/* Invite Member Dialog */}
      {canInvite && (
        <InviteMemberDialog
          tenantId={user.tenant.id}
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />
      )}
    </div>
  );
}