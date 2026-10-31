import { useState, useRef, useMemo, type KeyboardEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Square,
  Folder,
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  initialCollectionId?: string;
}

export function ChatInput({
  onSendMessage,
  isStreaming,
  onStop,
  disabled = false,
  initialCollectionId,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    initialCollectionId || null
  );
  const [prevInitialColId, setPrevInitialColId] = useState(initialCollectionId);
  if (initialCollectionId !== prevInitialColId) {
    setPrevInitialColId(initialCollectionId);
    setSelectedCollectionId(initialCollectionId || null);
  }
  const [collectionSearch, setCollectionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: collections = [] } = useCollections();
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) return collections;
    const q = collectionSearch.toLowerCase();
    return collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, collectionSearch]);

  const hasContent = content.trim().length > 0;
  const canSubmit = hasContent && !isStreaming && !disabled;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;

    const trimmed = content.trim();
    if (!trimmed) return;

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
          className="w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm focus-visible:ring-0 shadow-none min-h-11 max-h-48 text-fg placeholder:text-fg-muted/60 leading-relaxed"
        />

        {/* Footer controls inside Dock */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1.5">
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
                <span className="truncate max-w-36 sm:max-w-56">
                  {selectedCollection
                    ? selectedCollection.name
                    : t("chat.allCollections")}
                </span>
                <ChevronDown className="size-3 text-fg-muted shrink-0" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-64 flex flex-col p-0">
                {collections.length > 4 && (
                  <div className="p-1.5 border-b border-border bg-surface shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-fg-muted pointer-events-none" />
                      <Input
                        type="search"
                        placeholder={t("chat.searchCollection")}
                        value={collectionSearch}
                        onChange={(e) => setCollectionSearch(e.target.value)}
                        className="h-6 pl-6 pr-2 text-2xs bg-surface-muted/50"
                      />
                    </div>
                  </div>
                )}
                <div className="overflow-y-auto max-h-48 p-1">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedCollectionId(null);
                      setCollectionSearch("");
                    }}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="size-3.5 text-fg-muted" aria-hidden="true" />
                      <span>{t("chat.allCollections")}</span>
                    </div>
                    {!selectedCollectionId && (
                      <Check className="size-3.5 text-accent" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>

                  {filteredCollections.map((col) => {
                    const isSelected = selectedCollectionId === col.id;
                    return (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => {
                          setSelectedCollectionId(col.id);
                          setCollectionSearch("");
                        }}
                        className="flex items-center justify-between text-xs cursor-pointer"
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
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Action: Helper text + Send / Stop Button */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline text-2xs text-fg-muted/60">
              {t("chat.shiftEnterHint")}
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
                disabled={!canSubmit}
                aria-label={t("chat.send")}
                className={`size-8 rounded-xl transition-all duration-200 ${
                  canSubmit
                    ? "bg-accent text-accent-fg shadow-xs scale-100 opacity-100 cursor-pointer"
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
