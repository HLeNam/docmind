import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Hash,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  ExternalLink,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useSlackIntegration,
  useSlackChannels,
  useDisconnectSlack,
  useRemoveSlackChannel,
} from "../hooks/use-slack";
import { slackApi } from "../api/slack-api";
import type { SlackChannelMapping } from "../schemas/slack-schemas";
import { AddSlackChannelDialog } from "./add-slack-channel-dialog";
import { AppError } from "@/lib/api-client";

export function SlackSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: status, isLoading: isStatusLoading } = useSlackIntegration();
  const isConnected = !!status?.connected;
  const { data: channels = [], isLoading: isChannelsLoading } =
    useSlackChannels(isConnected);

  const disconnectMutation = useDisconnectSlack();
  const removeChannelMutation = useRemoveSlackChannel();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [channelToUnmap, setChannelToUnmap] =
    useState<SlackChannelMapping | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  if (!user) return null;

  const userRole = user.membership.role;
  const canManage = userRole === "OWNER" || userRole === "ADMIN";

  const handleConnectSlack = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const { url } = await slackApi.getInstallUrl();
      window.location.href = url;
    } catch (err) {
      setIsConnecting(false);
      if (err instanceof AppError) {
        setConnectError(
          t(`errors.${err.code}`, { defaultValue: err.message })
        );
      } else {
        setConnectError(t("common.error"));
      }
    }
  };

  const handleConfirmDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      setDisconnectConfirmOpen(false);
    } catch {
      // Handled by mutation
    }
  };

  const handleConfirmRemoveChannel = async () => {
    if (!channelToUnmap) return;
    try {
      await removeChannelMutation.mutateAsync(channelToUnmap.channelId);
      setChannelToUnmap(null);
    } catch {
      // Handled by mutation
    }
  };

  if (!canManage) {
    return (
      <div
        role="note"
        className="p-6 rounded-2xl border border-border bg-surface text-center space-y-3"
      >
        <div className="flex justify-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
            <Hash className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm text-fg-muted">{t("settings.memberOnlyNotice")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-fg tracking-tight">
          {t("settings.slackTitle")}
        </h2>
        <p className="text-sm text-fg-muted mt-0.5">
          {t("settings.slackSubtitle")}
        </p>
      </div>

      {connectError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-danger-soft text-danger text-xs border border-danger/20"
        >
          {connectError}
        </div>
      )}

      {/* Integration Status Card */}
      {isStatusLoading ? (
        <div className="p-8 rounded-2xl border border-border bg-surface flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 text-accent animate-spin" aria-hidden="true" />
          <p className="text-xs text-fg-muted">{t("common.loading")}</p>
        </div>
      ) : isConnected ? (
        <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-fg">
                    {t("settings.slackConnected")}
                  </h3>
                  <Badge variant="secondary" className="bg-success-soft text-success border-success/20 text-[11px]">
                    Active
                  </Badge>
                </div>
                {status?.slackTeamId && (
                  <p className="text-xs text-fg-muted mt-0.5 font-mono">
                    {t("settings.slackTeamId")}: {status.slackTeamId}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisconnectConfirmOpen(true)}
              className="gap-1.5 text-xs text-danger hover:text-danger hover:bg-danger-soft self-start sm:self-auto"
            >
              <Unplug className="size-3.5" aria-hidden="true" />
              <span>{t("settings.disconnectSlack")}</span>
            </Button>
          </div>

          {/* Channel Mapping Section */}
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-fg">
                  {t("settings.slackChannelMappingTitle")}
                </h4>
                <p className="text-xs text-fg-muted mt-0.5">
                  {t("settings.slackChannelMappingDesc")}
                </p>
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="gap-1.5 shrink-0 self-start sm:self-auto text-xs"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>{t("settings.addChannelMapping")}</span>
              </Button>
            </div>

            {isChannelsLoading ? (
              <div className="p-8 rounded-xl border border-border bg-surface-muted/30 flex items-center justify-center">
                <Loader2 className="size-5 text-accent animate-spin" aria-hidden="true" />
              </div>
            ) : channels.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
                <p className="text-xs font-medium text-fg">
                  {t("settings.noChannelMappings")}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {t("settings.noChannelMappingsDesc")}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-fg-muted border-b border-border">
                    <tr>
                      <th scope="col" className="py-2.5 px-3 font-medium">
                        {t("settings.slackChannelIdLabel")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 font-medium">
                        {t("settings.mappedCollectionLabel")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 font-medium text-right">
                        {t("collections.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {channels.map((mapping) => (
                      <tr
                        key={mapping.channelId}
                        className="hover:bg-surface-muted/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-fg">
                          <span className="inline-flex items-center gap-1.5">
                            <Hash className="size-3 text-fg-muted shrink-0" aria-hidden="true" />
                            <span>{mapping.channelId}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-fg">
                          <span className="inline-flex items-center gap-1.5">
                            <FolderOpen className="size-3 text-accent shrink-0" aria-hidden="true" />
                            <span>{mapping.collectionName}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setChannelToUnmap(mapping)}
                            aria-label={`${t("settings.unmapChannel")} ${mapping.channelId}`}
                            className="h-7 text-xs text-danger hover:text-danger hover:bg-danger-soft gap-1"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">
                              {t("settings.unmapChannel")}
                            </span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Not Connected State */
        <div className="p-8 rounded-2xl border border-dashed border-border bg-surface text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-fg-muted">
              <Hash className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-fg">
              {t("settings.slackNotConnected")}
            </h3>
            <p className="text-xs text-fg-muted mt-1 max-w-md mx-auto leading-relaxed">
              {t("settings.slackSubtitle")}
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            onClick={handleConnectSlack}
            disabled={isConnecting}
            className="gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>{t("common.loading")}</span>
              </>
            ) : (
              <>
                <ExternalLink className="size-4" aria-hidden="true" />
                <span>{t("settings.connectSlack")}</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Add Slack Channel Dialog */}
      <AddSlackChannelDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      {/* Disconnect Workspace Dialog */}
      <Dialog
        open={disconnectConfirmOpen}
        onOpenChange={setDisconnectConfirmOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-danger">
              <div className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </div>
              <DialogTitle>{t("settings.disconnectSlack")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs leading-relaxed">
              {t("settings.disconnectSlackConfirm")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectConfirmOpen(false)}
              disabled={disconnectMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDisconnect}
              disabled={disconnectMutation.isPending}
              className="gap-2"
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <span>{t("settings.disconnectSlack")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unmap Channel Dialog */}
      <Dialog
        open={!!channelToUnmap}
        onOpenChange={(open) => !open && setChannelToUnmap(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-danger">
              <div className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </div>
              <DialogTitle>{t("settings.unmapChannel")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs leading-relaxed">
              {t("settings.unmapChannelConfirm", {
                channelId: channelToUnmap?.channelId || "",
              })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChannelToUnmap(null)}
              disabled={removeChannelMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemoveChannel}
              disabled={removeChannelMutation.isPending}
              className="gap-2"
            >
              {removeChannelMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <span>{t("settings.unmapChannel")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}