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
  createCollectionSchema,
  type CreateCollectionFormData,
  type CollectionResponse,
} from "../schemas/collection-schemas";
import { useCreateCollection } from "../hooks/use-collections";
import { AppError } from "@/lib/api-client";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (collection: CollectionResponse) => void;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCollectionDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateCollection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCollectionFormData>({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      name: "",
      description: "",
      instructions: "",
    },
  });

  const onSubmit = async (data: CreateCollectionFormData) => {
    try {
      const created = await createMutation.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        instructions: data.instructions?.trim() || undefined,
      });
      reset();
      onOpenChange(false);
      onCreated?.(created);
    } catch {
      // Error is stored in createMutation.error
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      createMutation.reset();
    }
    onOpenChange(newOpen);
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("collections.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("collections.createDescription")}
            </DialogDescription>
          </DialogHeader>

          {createMutation.error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger/20"
            >
              {getErrorMessage()}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="collection-name" className="text-sm font-medium text-fg">
                {t("collections.nameLabel")}{" "}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="collection-name"
                {...register("name")}
                placeholder={t("collections.namePlaceholder")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "collection-name-error" : undefined}
                disabled={isSubmitting || createMutation.isPending}
                autoFocus
              />
              {errors.name && (
                <p
                  id="collection-name-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="collection-description"
                className="text-sm font-medium text-fg"
              >
                {t("collections.descriptionLabel")}
              </Label>
              <Textarea
                id="collection-description"
                {...register("description")}
                placeholder={t("collections.descriptionPlaceholder")}
                rows={2}
                aria-invalid={!!errors.description}
                aria-describedby={
                  errors.description ? "collection-desc-error" : undefined
                }
                disabled={isSubmitting || createMutation.isPending}
              />
              {errors.description && (
                <p
                  id="collection-desc-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="collection-instructions"
                className="text-sm font-medium text-fg"
              >
                {t("collections.instructionsLabel")}
              </Label>
              <Textarea
                id="collection-instructions"
                {...register("instructions")}
                placeholder={t("collections.instructionsPlaceholder")}
                rows={2}
                aria-invalid={!!errors.instructions}
                aria-describedby={
                  errors.instructions ? "collection-instructions-error" : undefined
                }
                disabled={isSubmitting || createMutation.isPending}
              />
              {errors.instructions && (
                <p
                  id="collection-instructions-error"
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
                <span>{t("collections.createButton")}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
