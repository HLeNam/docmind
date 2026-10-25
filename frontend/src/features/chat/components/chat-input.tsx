import { useState, useRef, type KeyboardEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Square, Folder, Check, ChevronDown } from "lucide-react";
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

  const hasContent = content.trim().length > 0;

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
        200
      )}px`;
    }
  };

  return (
    <div className="p-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface/95 shadow-md backdrop-blur-md transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 p-2.5 space-y-2"
      >
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder={t("chat.inputPlaceholder")}
          rows={1}
          disabled={disabled || isStreaming}
          className="w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm focus-visible:ring-0 shadow-none min-h-[46px] max-h-48 text-fg placeholder:text-fg-muted/60 leading-relaxed"
        />

        {/* Footer controls inside Dock */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
          {/* Collection Filter Selector Pill */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-muted/60 hover:bg-surface-muted text-fg text-xs font-medium border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              }
            >
              <Folder className="size-3.5 text-accent shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {selectedCollection
                  ? selectedCollection.name
                  : t("chat.allCollections")}
              </span>
              <ChevronDown className="size-3 text-fg-muted shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => setSelectedCollectionId(null)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Folder className="size-3.5 text-fg-muted" aria-hidden="true" />
                  <span>{t("chat.allCollections")}</span>
                </div>
                {!selectedCollectionId && (
                  <Check className="size-3.5 text-accent" aria-hidden="true" />
                )}
              </DropdownMenuItem>

              {collections.map((col) => {
                const isSelected = selectedCollectionId === col.id;
                return (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => setSelectedCollectionId(col.id)}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                      <span className="truncate">{col.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 text-accent" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Right Action: Helper text + Send / Stop Button */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline text-[11px] text-fg-muted/60">
              Shift + Enter xuống dòng
            </span>

            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onStop}
                className="h-8 px-3 text-xs gap-1.5 rounded-xl shadow-xs"
              >
                <Square className="size-3 fill-current animate-pulse" aria-hidden="true" />
                <span>{t("chat.stop")}</span>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="default"
                size="icon-xs"
                disabled={!hasContent || disabled}
                aria-label={t("chat.send")}
                className={`size-8 rounded-xl transition-all duration-200 ${
                  hasContent
                    ? "bg-accent text-accent-fg shadow-xs scale-100 opacity-100"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}