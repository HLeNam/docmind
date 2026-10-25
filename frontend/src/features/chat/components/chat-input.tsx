import { useState, useRef, type KeyboardEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Square, Folder, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollections } from "@/features/collections";

interface ChatInputProps {
  onSendMessage: (content: string, collectionId?: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  disabled?: boolean;
}

export function ChatInput({
  onSendMessage,
  isStreaming,
  onStop,
  disabled = false,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: collections = [] } = useCollections();

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isStreaming || disabled) return;

    onSendMessage(trimmed, selectedCollectionId || undefined);
    setContent("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  };

  return (
    <div className="p-4 bg-surface/80 backdrop-blur-md border-t border-border">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface p-2 shadow-xs transition-colors focus-within:border-accent"
      >
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder={t("chat.inputPlaceholder")}
          rows={1}
          disabled={disabled}
          className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm focus-visible:ring-0 shadow-none min-h-[44px] max-h-44 text-fg"
        />

        <div className="flex items-center justify-between pt-2 px-1 border-t border-border/40 text-xs">
          {/* Collection Filter Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-fg-muted hover:text-fg gap-1.5"
                />
              }
            >
              <Folder className="size-3.5 text-accent shrink-0" aria-hidden="true" />
              <span className="truncate max-w-40">
                {selectedCollection
                  ? selectedCollection.name
                  : t("chat.allCollections")}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onClick={() => setSelectedCollectionId(null)}
                className="flex items-center justify-between"
              >
                <span>{t("chat.allCollections")}</span>
                {!selectedCollectionId && (
                  <Check className="size-3.5 text-accent" aria-hidden="true" />
                )}
              </DropdownMenuItem>

              {collections.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className="flex items-center justify-between truncate"
                >
                  <span className="truncate">{col.name}</span>
                  {selectedCollectionId === col.id && (
                    <Check className="size-3.5 text-accent" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action Button: Send or Stop */}
          <div>
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={onStop}
                title={t("chat.stop")}
                aria-label={t("chat.stop")}
                className="rounded-full size-8"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={!content.trim() || disabled}
                title={t("chat.send")}
                aria-label={t("chat.send")}
                className="rounded-full size-8"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
