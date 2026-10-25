import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConversationItem } from "../schemas/conversation-schemas";
import { useDeleteConversation } from "../hooks/use-conversations";
import { AppError } from "@/lib/api-client";

interface DeleteConversationDialogProps {
  conversation: ConversationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteConversationDialog({
  conversation,
  open,
  onOpenChange,
  onDeleted,
}: DeleteConversationDialogProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteConversation();

  if (!conversation) return null;

  const title = conversation.title || conversation.preview || "Hội thoại";

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(conversation.id);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // Error handled via deleteMutation.error
    }
  };

  const getErrorMessage = () => {
    if (!deleteMutation.error) return null;
    if (deleteMutation.error instanceof AppError) {
      return t(`errors.${deleteMutation.error.code}`, {
        defaultValue: deleteMutation.error.message,
      });
    }
    return t("common.error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle className="text-danger">
              {t("chat.deleteConversation")}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {t("chat.deleteConfirm")}
            <span className="block mt-2 font-medium text-fg italic truncate">
              "{title}"
            </span>
          </DialogDescription>
        </DialogHeader>

        {deleteMutation.error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger/20"
          >
            {getErrorMessage()}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                <span>{t("common.loading")}</span>
              </>
            ) : (
              <span>{t("common.delete")}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
