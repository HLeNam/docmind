import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyRound,
  Plus,
  Trash2,
  Loader2,
  ShieldAlert,
  FolderOpen,
  Building2,
  Calendar,
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
import { useCollections } from "@/features/collections";
import {
  useApiKeys,
  useRevokeApiKey,
} from "../hooks/use-api-keys";
import type { ApiKeyItem } from "../schemas/api-key-schemas";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

export function ApiKeysSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: keys = [], isLoading } = useApiKeys();
  const { data: collections = [] } = useCollections();
  const revokeMutation = useRevokeApiKey();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);

  if (!user) return null;

  const userRole = user.membership.role;
  const canManage = userRole === "OWNER" || userRole === "ADMIN";

  const getCollectionName = (collectionId: string | null) => {
    if (!collectionId) return null;
    const found = collections.find((c) => c.id === collectionId);
    return found ? found.name : collectionId.slice(0, 8);
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      await revokeMutation.mutateAsync(keyToRevoke.id);
      setKeyToRevoke(null);
    } catch {
      // Error in mutation
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
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm text-fg-muted">{t("settings.memberOnlyNotice")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg tracking-tight">
            {t("settings.apiKeysTitle")}
          </h2>
          <p className="text-sm text-fg-muted mt-0.5">
            {t("settings.apiKeysSubtitle")}
          </p>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>{t("settings.createApiKey")}</span>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-12 rounded-2xl border border-border bg-surface flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 text-accent animate-spin" aria-hidden="true" />
          <p className="text-xs text-fg-muted">{t("common.loading")}</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-surface text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-fg-muted">
              <KeyRound className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-fg">
              {t("settings.noApiKeys")}
            </h3>
            <p className="text-xs text-fg-muted mt-1 max-w-sm mx-auto">
              {t("settings.noApiKeysDesc")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>{t("settings.createApiKey")}</span>
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/60 text-fg-muted border-b border-border">
                <tr>
                  <th scope="col" className="py-3 px-4 font-medium">
                    {t("settings.tableKeyName")}
                  </th>
                  <th scope="col" className="py-3 px-4 font-medium">
                    {t("settings.tableKeyPrefix")}
                  </th>
                  <th scope="col" className="py-3 px-4 font-medium">
                    {t("settings.tableScope")}
                  </th>
                  <th scope="col" className="py-3 px-4 font-medium">
                    {t("settings.tableCreated")}
                  </th>
                  <th scope="col" className="py-3 px-4 font-medium">
                    {t("settings.tableStatus")}
                  </th>
                  <th scope="col" className="py-3 px-4 font-medium text-right">
                    {t("collections.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((key) => {
                  const isRevoked = !!key.revokedAt;
                  const collectionName = getCollectionName(key.collectionId);

                  return (
                    <tr
                      key={key.id}
                      className="hover:bg-surface-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-fg">
                        <div className="flex items-center gap-2">
                          <KeyRound className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[160px] sm:max-w-[220px]">
                            {key.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-fg-muted">
                        <span className="px-1.5 py-0.5 rounded bg-surface-muted border border-border">
                          {key.keyPrefix}••••••
                        </span>
                      </td>

                      <td className="py-3 px-4 text-fg-muted">
                        {collectionName ? (
                          <span className="inline-flex items-center gap-1.5">
                            <FolderOpen className="size-3 text-accent shrink-0" aria-hidden="true" />
                            <span className="truncate max-w-[140px]">
                              {collectionName}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="size-3 text-fg-muted shrink-0" aria-hidden="true" />
                            <span>{t("settings.scopeAll")}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-fg-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" aria-hidden="true" />
                          <span>
                            {new Date(key.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isRevoked ? (
                          <Badge variant="outline" className="text-fg-muted gap-1 text-[11px]">
                            <span className="size-1.5 rounded-full bg-fg-muted" />
                            {t("settings.keyRevoked")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-success-soft text-success border-success/20 gap-1 text-[11px]">
                            <span className="size-1.5 rounded-full bg-success" />
                            {t("settings.keyActive")}
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isRevoked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setKeyToRevoke(key)}
                            aria-label={`${t("settings.revokeKey")} ${key.name}`}
                            className="h-7 text-xs text-danger hover:text-danger hover:bg-danger-soft gap-1"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">
                              {t("settings.revokeKey")}
                            </span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create API Key Dialog */}
      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={!!keyToRevoke}
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-danger">
              <div className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <ShieldAlert className="size-4" aria-hidden="true" />
              </div>
              <DialogTitle>{t("settings.revokeKey")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs leading-relaxed">
              {t("settings.revokeKeyConfirm", {
                name: keyToRevoke?.name || "",
              })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setKeyToRevoke(null)}
              disabled={revokeMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={revokeMutation.isPending}
              className="gap-2"
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <span>{t("settings.revokeKey")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}