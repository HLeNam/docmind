import { useTranslation } from "react-i18next";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CollectionResponse } from "../schemas/collection-schemas";
import { useDeleteCollection } from "../hooks/use-collections";
import { AppError } from "@/lib/api-client";

interface DeleteCollectionDialogProps {
  collection: CollectionResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCollectionDialogProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteCollection();

  if (!collection) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(collection.id);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // Handled via deleteMutation.error
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
              {t("collections.deleteTitle")}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {t("collections.deleteConfirmMessage", { name: collection.name })}
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
              <span>{t("collections.deleteButton")}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
