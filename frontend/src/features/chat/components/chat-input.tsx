import { useState, useRef, useMemo, type KeyboardEvent, type FormEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Square,
  Folder,
  Check,
  ChevronDown,
  Search,
  Paperclip,
  X,
  Loader2,
  AlertCircle,
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
import { formatBytes } from "@/lib/utils";
import { ALLOWED_MIME_EXTENSIONS } from "@/features/documents";
import { useCollections } from "@/features/collections";

interface ChatInputProps {
  onSendMessage: (content: string, collectionId?: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  disabled?: boolean;
  attachedFiles?: File[];
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
  isUploadingFiles?: boolean;
  fileError?: string | null;
}

export function ChatInput({
  onSendMessage,
  isStreaming,
  onStop,
  disabled = false,
  attachedFiles = [],
  onAddFiles,
  onRemoveFile,
  isUploadingFiles = false,
  fileError = null,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: collections = [] } = useCollections();
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) return collections;
    const q = collectionSearch.toLowerCase();
    return collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, collectionSearch]);

  const hasContent = content.trim().length > 0;
  const hasFiles = attachedFiles.length > 0;
  const canSubmit = (hasContent || hasFiles) && !isStreaming && !disabled && !isUploadingFiles;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;

    const trimmed = content.trim();
    const finalContent = trimmed || (hasFiles ? t("chat.defaultFilePrompt") : "");
    if (!finalContent) return;

    onSendMessage(finalContent, selectedCollectionId || undefined);
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

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles?.(Array.from(e.target.files));
      // Reset input value so re-selecting the same file triggers change
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface/95 shadow-md backdrop-blur-md transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 p-2.5 space-y-2"
      >
        {/* Attached Files Tray */}
        {hasFiles && (
          <div className="flex flex-wrap items-center gap-2 px-1 pt-1 pb-2 border-b border-border/50">
            {attachedFiles.map((file, idx) => {
              const ext = file.name.split(".").pop()?.toUpperCase() || "DOC";
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-surface-muted border border-border text-xs group"
                >
                  <span className="font-mono text-2xs px-1.5 py-0.5 rounded-sm bg-accent-soft text-accent font-semibold leading-none">
                    {ext}
                  </span>
                  <span className="max-w-[150px] sm:max-w-[200px] truncate text-fg font-medium" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-2xs text-fg-muted tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                  {onRemoveFile && (
                    <button
                      type="button"
                      disabled={disabled || isStreaming || isUploadingFiles}
                      onClick={() => onRemoveFile(idx)}
                      aria-label={t("chat.removeAttachment")}
                      className="size-4 flex items-center justify-center rounded-sm hover:bg-surface text-fg-muted hover:text-danger transition-colors cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Uploading indicator or validation error banner */}
        {isUploadingFiles && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-accent bg-accent-soft/30 rounded-lg animate-pulse">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>{t("chat.uploadingFiles", { count: attachedFiles.length })}</span>
          </div>
        )}

        {fileError && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-2xs text-danger bg-danger-soft/30 border border-danger/20 rounded-lg">
            <AlertCircle className="size-3 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder={hasFiles ? t("chat.inputPlaceholder") : t("chat.inputPlaceholder")}
          rows={1}
          disabled={disabled || isStreaming || isUploadingFiles}
          className="w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm focus-visible:ring-0 shadow-none min-h-[46px] max-h-48 text-fg placeholder:text-fg-muted/60 leading-relaxed"
        />

        {/* Footer controls inside Dock */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1.5">
            {/* File Attachment Hidden Input & Paperclip Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_MIME_EXTENSIONS.join(",")}
              onChange={handleFileInputChange}
              className="hidden"
              id="chat-file-attachment"
              disabled={disabled || isStreaming || isUploadingFiles}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming || isUploadingFiles}
              title={t("chat.attachFiles")}
              aria-label={t("chat.attachFiles")}
              className="text-fg-muted hover:text-fg"
            >
              <Paperclip className="size-4" aria-hidden="true" />
            </Button>

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
                <span className="truncate max-w-[120px] sm:max-w-[200px]">
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
                {isUploadingFiles ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="size-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
