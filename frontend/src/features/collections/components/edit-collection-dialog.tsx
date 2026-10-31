import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  updateCollectionSchema,
  type UpdateCollectionFormData,
  type CollectionResponse,
} from "../schemas/collection-schemas";
import { useUpdateCollection } from "../hooks/use-collections";
import { AppError } from "@/lib/api-client";

interface EditCollectionDialogProps {
  collection: CollectionResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCollectionDialog({
  collection,
  open,
  onOpenChange,
}: EditCollectionDialogProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdateCollection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCollectionFormData>({
    resolver: zodResolver(updateCollectionSchema),
    defaultValues: {
      name: collection.name,
      description: collection.description || "",
      instructions: collection.instructions || "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: collection.name,
        description: collection.description || "",
        instructions: collection.instructions || "",
      });
    }
  }, [open, collection, reset]);

  const onSubmit = async (data: UpdateCollectionFormData) => {
    try {
      await updateMutation.mutateAsync({
        id: collection.id,
        dto: {
          name: data.name?.trim(),
          description: data.description?.trim() || undefined,
          instructions: data.instructions?.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch {
      // Error handled via updateMutation.error
    }
  };

  const getErrorMessage = () => {
    if (!updateMutation.error) return null;
    if (updateMutation.error instanceof AppError) {
      return t(`errors.${updateMutation.error.code}`, {
        defaultValue: updateMutation.error.message,
      });
    }
    return t("common.error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("collections.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("collections.editDescription")}
            </DialogDescription>
          </DialogHeader>

          {updateMutation.error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger/20"
            >
              {getErrorMessage()}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-collection-name" className="text-sm font-medium text-fg">
                {t("collections.nameLabel")}
              </Label>
              <Input
                id="edit-collection-name"
                {...register("name")}
                placeholder={t("collections.namePlaceholder")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "edit-collection-name-error" : undefined}
                disabled={isSubmitting || updateMutation.isPending}
              />
              {errors.name && (
                <p
                  id="edit-collection-name-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-collection-desc"
                className="text-sm font-medium text-fg"
              >
                {t("collections.descriptionLabel")}
              </Label>
              <Textarea
                id="edit-collection-desc"
                {...register("description")}
                placeholder={t("collections.descriptionPlaceholder")}
                rows={2}
                aria-invalid={!!errors.description}
                aria-describedby={
                  errors.description ? "edit-collection-desc-error" : undefined
                }
                disabled={isSubmitting || updateMutation.isPending}
              />
              {errors.description && (
                <p
                  id="edit-collection-desc-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-collection-instructions"
                className="text-sm font-medium text-fg"
              >
                {t("collections.instructionsLabel")}
              </Label>
              <Textarea
                id="edit-collection-instructions"
                {...register("instructions")}
                placeholder={t("collections.instructionsPlaceholder")}
                rows={3}
                aria-invalid={!!errors.instructions}
                aria-describedby={
                  errors.instructions ? "edit-collection-instructions-error" : undefined
                }
                disabled={isSubmitting || updateMutation.isPending}
              />
              {errors.instructions && (
                <p
                  id="edit-collection-instructions-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.instructions.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || updateMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
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
