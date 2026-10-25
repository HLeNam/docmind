import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Hash, FolderOpen, Loader2, Info } from "lucide-react";
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
  mapChannelSchema,
  type MapChannelFormData,
} from "../schemas/slack-schemas";
import { useUpsertSlackChannel } from "../hooks/use-slack";
import { useCollections } from "@/features/collections";
import { AppError } from "@/lib/api-client";

interface AddSlackChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddSlackChannelDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddSlackChannelDialogProps) {
  const { t } = useTranslation();
  const upsertMutation = useUpsertSlackChannel();
  const { data: collections = [] } = useCollections();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MapChannelFormData>({
    resolver: zodResolver(mapChannelSchema),
    defaultValues: {
      channelId: "",
      collectionId: "",
    },
  });

  const onSubmit = async (data: MapChannelFormData) => {
    try {
      await upsertMutation.mutateAsync(data);
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error in mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      upsertMutation.reset();
    }
    onOpenChange(newOpen);
  };

  const getErrorMessage = () => {
    if (!upsertMutation.error) return null;
    if (upsertMutation.error instanceof AppError) {
      return t(`errors.${upsertMutation.error.code}`, {
        defaultValue: upsertMutation.error.message,
      });
    }
    return t("common.error");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Hash className="size-4" aria-hidden="true" />
              </div>
              <DialogTitle>{t("settings.addChannelMapping")}</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-xs">
              {t("settings.slackChannelMappingDesc")}
            </DialogDescription>
          </DialogHeader>

          {upsertMutation.error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-danger-soft text-danger text-xs border border-danger/20"
            >
              {getErrorMessage()}
            </div>
          )}

          <div className="space-y-3">
            {/* Channel ID */}
            <div className="space-y-1.5">
              <Label htmlFor="slack-channel-id" className="text-xs font-medium text-fg flex items-center gap-1.5">
                <Hash className="size-3.5 text-fg-muted" aria-hidden="true" />
                <span>{t("settings.slackChannelIdLabel")}</span>
                <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="slack-channel-id"
                {...register("channelId")}
                placeholder={t("settings.slackChannelIdPlaceholder")}
                className="font-mono text-xs uppercase"
                disabled={isSubmitting || upsertMutation.isPending}
              />
              {errors.channelId && (
                <p role="alert" className="text-xs text-danger">
                  {errors.channelId.message}
                </p>
              )}
              <div className="flex items-start gap-1.5 text-[11px] text-fg-muted">
                <Info className="size-3.5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t("settings.slackChannelIdHelp")}</span>
              </div>
            </div>

            {/* Collection Select */}
            <div className="space-y-1.5">
              <Label htmlFor="slack-collection-id" className="text-xs font-medium text-fg flex items-center gap-1.5">
                <FolderOpen className="size-3.5 text-fg-muted" aria-hidden="true" />
                <span>{t("settings.mappedCollectionLabel")}</span>
                <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <select
                id="slack-collection-id"
                {...register("collectionId")}
                className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || upsertMutation.isPending}
              >
                <option value="">{t("settings.selectCollection")}</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              {errors.collectionId && (
                <p role="alert" className="text-xs text-danger">
                  {errors.collectionId.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting || upsertMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <span>{t("common.save")}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}