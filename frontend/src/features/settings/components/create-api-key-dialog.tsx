import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  FolderOpen,
} from "lucide-react";
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
  createApiKeySchema,
  type CreateApiKeyFormData,
  type ApiKeyCreatedResponse,
} from "../schemas/api-key-schemas";
import { useCreateApiKey } from "../hooks/use-api-keys";
import { useCollections } from "@/features/collections";
import { AppError } from "@/lib/api-client";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (apiKey: ApiKeyCreatedResponse) => void;
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateApiKey();
  const { data: collections = [] } = useCollections();

  const [createdApiKey, setCreatedApiKey] =
    useState<ApiKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      collectionId: "",
    },
  });

  const onSubmit = async (data: CreateApiKeyFormData) => {
    try {
      const res = await createMutation.mutateAsync(data);
      setCreatedApiKey(res);
      onSuccess?.(res);
    } catch {
      // Error in mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setCreatedApiKey(null);
      setCopiedKey(false);
      createMutation.reset();
    }
    onOpenChange(newOpen);
  };

  const handleCopyKey = async () => {
    if (!createdApiKey) return;
    try {
      await navigator.clipboard.writeText(createdApiKey.key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
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
        {createdApiKey ? (
          /* Success Screen: Display raw API key once */
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-success">
                <div className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                  <Check className="size-4" aria-hidden="true" />
                </div>
                <DialogTitle>{t("settings.createKeySuccess")}</DialogTitle>
              </div>
              <DialogDescription className="pt-1">
                {createdApiKey.name}
              </DialogDescription>
            </DialogHeader>

            {/* Warning Callout */}
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
            >
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{t("settings.copyKeyWarning")}</p>
            </div>

            {/* Key Field with Copy */}
            <div className="p-3 rounded-xl bg-surface-muted border border-border space-y-1.5">
              <Label className="text-xs text-fg-muted">
                {t("settings.tableKeyName")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdApiKey.key}
                  className="h-9 font-mono text-xs bg-surface"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  className="shrink-0 gap-1.5 h-9 text-xs"
                >
                  {copiedKey ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      <span>{t("chat.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
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
          /* Form to create new key */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <KeyRound className="size-4" aria-hidden="true" />
                </div>
                <DialogTitle>{t("settings.createApiKey")}</DialogTitle>
              </div>
              <DialogDescription className="pt-1">
                {t("settings.createApiKeyDesc")}
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
              {/* Key Name Field */}
              <div className="space-y-1.5">
                <Label htmlFor="key-name" className="text-xs font-medium text-fg">
                  {t("settings.keyNameLabel")}{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="key-name"
                  {...register("name")}
                  placeholder={t("settings.keyNamePlaceholder")}
                  autoFocus
                  disabled={isSubmitting || createMutation.isPending}
                />
                {errors.name && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Scope Selection (Collection or All) */}
              <div className="space-y-1.5">
                <Label htmlFor="key-scope" className="text-xs font-medium text-fg flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-fg-muted" aria-hidden="true" />
                  <span>{t("settings.keyScopeLabel")}</span>
                </Label>
                <select
                  id="key-scope"
                  {...register("collectionId")}
                  className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || createMutation.isPending}
                >
                  <option value="">{t("settings.scopeAll")}</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {t("settings.scopeCollection")}: {col.name}
                    </option>
                  ))}
                </select>
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
                  <span>{t("settings.createApiKey")}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}