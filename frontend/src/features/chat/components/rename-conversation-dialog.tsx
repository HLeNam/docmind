import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConversationItem } from "../schemas/conversation-schemas";
import { useRenameConversation } from "../hooks/use-conversations";
import { AppError } from "@/lib/api-client";

interface RenameConversationDialogProps {
  conversation: ConversationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RenameFormProps {
  conversation: ConversationItem;
  onClose: () => void;
}

function RenameForm({ conversation, onClose }: RenameFormProps) {
  const { t } = useTranslation();
  const renameMutation = useRenameConversation();
  const [title, setTitle] = useState(
    conversation.title || conversation.preview || ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setValidationError("Tiêu đề không được để trống");
      return;
    }
    if (trimmed.length > 100) {
      setValidationError("Tiêu đề không vượt quá 100 ký tự");
      return;
    }

    try {
      await renameMutation.mutateAsync({
        id: conversation.id,
        dto: { title: trimmed },
      });
      onClose();
    } catch {
      // Error handled via renameMutation.error
    }
  };

  const getErrorMessage = () => {
    if (!renameMutation.error) return null;
    if (renameMutation.error instanceof AppError) {
      return t(`errors.${renameMutation.error.code}`, {
        defaultValue: renameMutation.error.message,
      });
    }
    return t("common.error");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t("chat.renameConversation")}</DialogTitle>
      </DialogHeader>

      {renameMutation.error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-danger-soft text-danger text-sm border border-danger/20"
        >
          {getErrorMessage()}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rename-input" className="text-sm font-medium text-fg">
          Tiêu đề hội thoại
        </Label>
        <Input
          id="rename-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setValidationError(null);
          }}
          placeholder="Nhập tiêu đề hội thoại..."
          autoFocus
          disabled={renameMutation.isPending}
        />
        {validationError && (
          <p role="alert" className="text-xs text-danger">
            {validationError}
          </p>
        )}
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={renameMutation.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={renameMutation.isPending || !title.trim()}
        >
          {renameMutation.isPending ? (
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
  );
}

export function RenameConversationDialog({
  conversation,
  open,
  onOpenChange,
}: RenameConversationDialogProps) {
  if (!conversation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <RenameForm
          key={conversation.id}
          conversation={conversation}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
