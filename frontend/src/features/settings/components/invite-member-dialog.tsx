import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2, UserPlus, Check, Copy, Shield, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInvitationSchema,
  type CreateInvitationFormData,
  type InvitationResponse,
} from "../schemas/invitation-schemas";
import { useCreateInvitation } from "../hooks/use-invitations";
import { AppError } from "@/lib/api-client";

interface InviteMemberDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (invitation: InvitationResponse) => void;
}

export function InviteMemberDialog({
  tenantId,
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateInvitation(tenantId);
  const [createdInvitation, setCreatedInvitation] =
    useState<InvitationResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvitationFormData>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  const onSubmit = async (data: CreateInvitationFormData) => {
    try {
      const res = await createMutation.mutateAsync({
        ...data,
        role: selectedRole,
      });
      setCreatedInvitation(res);
      onSuccess?.(res);
    } catch {
      // Error in createMutation.error
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setSelectedRole("MEMBER");
      setCreatedInvitation(null);
      setCopiedLink(false);
      createMutation.reset();
    }
    onOpenChange(newOpen);
  };

  const handleCopyInviteLink = async () => {
    if (!createdInvitation) return;
    const inviteUrl = `${window.location.origin}/accept-invite?token=${createdInvitation.token}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Copy failed
    }
  };

  const getErrorMessage = () => {
    if (!createMutation.error) return null;
    if (createMutation.error instanceof AppError) {
      return t(`errors.${createMutation.error.code}`, {
        defaultValue: createMutation.error.message,
      });
    }
    return t("common.error");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {createdInvitation ? (
          /* Success Screen with Copy Link */
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-success">
                <div className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                  <Check className="size-4" aria-hidden="true" />
                </div>
                <DialogTitle>{t("settings.inviteSuccessTitle")}</DialogTitle>
              </div>
              <DialogDescription className="pt-1">
                {t("settings.inviteSuccessDesc", { email: createdInvitation.email })}
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-xl bg-surface-muted border border-border space-y-2">
              <Label className="text-xs text-fg-muted">
                {t("settings.inviteLinkLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/accept-invite?token=${createdInvitation.token}`}
                  className="h-8 font-mono text-xs bg-surface"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteLink}
                  className="shrink-0 gap-1.5 h-8 text-xs"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3 text-success" />
                      <span>{t("chat.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>{t("chat.copy")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="default"
                onClick={() => handleOpenChange(false)}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Invitation Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <UserPlus className="size-4" aria-hidden="true" />
                </div>
                <DialogTitle>{t("settings.inviteMemberTitle")}</DialogTitle>
              </div>
              <DialogDescription className="pt-1">
                {t("settings.inviteMemberDesc")}
              </DialogDescription>
            </DialogHeader>

            {createMutation.error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-danger-soft text-danger text-xs border border-danger/20"
              >
                {getErrorMessage()}
              </div>
            )}

            <div className="space-y-3">
              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-medium text-fg">
                  {t("auth.emailLabel")}{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  {...register("email")}
                  placeholder="dongnghiep@congty.com"
                  autoFocus
                  disabled={isSubmitting || createMutation.isPending}
                />
                {errors.email && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Role selection radio-cards */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-fg">
                  {t("settings.roleLabel")}
                </Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("settings.roleLabel")}>
                  {/* MEMBER Role */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === "MEMBER"}
                    onClick={() => {
                      setSelectedRole("MEMBER");
                      setValue("role", "MEMBER");
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      selectedRole === "MEMBER"
                        ? "border-accent bg-accent-soft/30 ring-1 ring-accent"
                        : "border-border bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-fg mb-1">
                      <User className="size-3.5 text-fg-muted" aria-hidden="true" />
                      <span>{t("auth.roleMember")}</span>
                    </div>
                    <p className="text-2xs text-fg-muted leading-tight">
                      {t("settings.roleMemberDesc")}
                    </p>
                  </button>

                  {/* ADMIN Role */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === "ADMIN"}
                    onClick={() => {
                      setSelectedRole("ADMIN");
                      setValue("role", "ADMIN");
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      selectedRole === "ADMIN"
                        ? "border-accent bg-accent-soft/30 ring-1 ring-accent"
                        : "border-border bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-fg mb-1">
                      <Shield className="size-3.5 text-accent" aria-hidden="true" />
                      <span>{t("auth.roleAdmin")}</span>
                    </div>
                    <p className="text-2xs text-fg-muted leading-tight">
                      {t("settings.roleAdminDesc")}
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting || createMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isSubmitting || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                    <span>{t("common.loading")}</span>
                  </>
                ) : (
                  <span>{t("settings.sendInviteButton")}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
