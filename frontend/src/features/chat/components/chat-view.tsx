import { useState, useRef, useEffect, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  PanelLeft,
  Bookmark,
  Sparkles,
  Download,
  FolderPlus,
  Upload,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourcePanel } from "@/components/domain/source-panel";
import { DocumentViewerModal } from "@/components/domain/document-viewer-modal";
import {
  useCollections,
  useCreateCollection,
  COLLECTIONS_QUERY_KEY,
} from "@/features/collections";
import {
  documentsApi,
  getDocumentsQueryKey,
  ALLOWED_MIME_EXTENSIONS,
  MAX_DOCUMENT_SIZE,
  MAX_TABULAR_SIZE,
} from "@/features/documents";
import { ConversationList } from "./conversation-list";
import { ChatMessageItem } from "./chat-message-item";
import { ChatInput } from "./chat-input";
import { useChatMessages } from "../hooks/use-chat-messages";
import { useChatStream } from "../hooks/use-chat-stream";
import type { ChatCitation } from "../schemas/chat-schemas";

interface ChatViewProps {
  initialConversationId?: string | null;
}

export function ChatView({ initialConversationId }: ChatViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createCollectionMutation = useCreateCollection();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId || null
  );

  const { data: collections = [], isLoading: isLoadingCollections } = useCollections();

  const [showLeftSidebar, setShowLeftSidebar] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    return true;
  });
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);
  const [viewingCitation, setViewingCitation] = useState<ChatCitation | null>(null);

  // File attachment & Drag and Drop state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounter = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [prevInitialId, setPrevInitialId] = useState(initialConversationId);
  if (initialConversationId !== prevInitialId) {
    setPrevInitialId(initialConversationId);
    setActiveConversationId(initialConversationId || null);
    setActiveCitation(null);
  }

  // TanStack Query for messages in active conversation
  const { data: messagesData, isLoading: isLoadingMessages } =
    useChatMessages(activeConversationId);

  // SSE Stream Engine
  const {
    isStreaming,
    streamAnswer,
    streamCitations,
    rewrittenQuery,
    streamError,
    pendingPrompt,
    sendMessage,
    stopStreaming,
    setActiveConversationId: setStreamConvId,
  } = useChatStream({
    onConversationCreated: (newId) => {
      setActiveConversationId(newId);
      navigate({
        to: "/",
        search: { c: newId },
        replace: true,
      });
    },
  });

  // Keep active conversation id synchronized and push to URL
  const handleSelectConversation = (id: string | null) => {
    setActiveConversationId(id);
    setStreamConvId(id);
    setActiveCitation(null);
    navigate({
      to: "/",
      search: { c: id || undefined },
      replace: false,
    });
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setStreamConvId(null);
    setActiveCitation(null);
    navigate({
      to: "/",
      search: { c: undefined },
      replace: false,
    });
  };

  const handleCitationClick = (citation: ChatCitation) => {
    setActiveCitation(citation);
    setShowSourcePanel(true);
  };

  const validateFile = (file: File): string | null => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const isAllowed = ALLOWED_MIME_EXTENSIONS.some(
      (ext) => ext.toLowerCase() === extension
    );

    if (!isAllowed) {
      return t("documents.fileInvalidType", { name: file.name });
    }

    const isTabular = extension === ".xlsx" || extension === ".csv";
    const maxSize = isTabular ? MAX_TABULAR_SIZE : MAX_DOCUMENT_SIZE;
    const maxSizeMb = isTabular ? 10 : 50;

    if (file.size > maxSize) {
      return t("documents.fileTooLarge", {
        name: file.name,
        maxSize: maxSizeMb,
      });
    }

    return null;
  };

  const handleAddFiles = (newFiles: File[]) => {
    setFileError(null);
    const validFiles: File[] = [];

    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        return;
      }
      const isDuplicate = attachedFiles.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (!isDuplicate) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Full window drag and drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverWindow(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOverWindow(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOverWindow(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSend = async (content: string, collectionId?: string) => {
    let targetCollectionId = collectionId;

    if (attachedFiles.length > 0) {
      setIsUploadingFiles(true);
      setFileError(null);
      try {
        if (!targetCollectionId) {
          if (collections.length > 0) {
            targetCollectionId = collections[0].id;
          } else {
            const newCol = await createCollectionMutation.mutateAsync({
              name: t("chat.defaultCollectionName") || "Tài liệu tải lên",
            });
            targetCollectionId = newCol.id;
          }
        }

        for (const file of attachedFiles) {
          await documentsApi.upload(targetCollectionId, file);
        }

        queryClient.invalidateQueries({
          queryKey: getDocumentsQueryKey(targetCollectionId),
        });
        queryClient.invalidateQueries({
          queryKey: COLLECTIONS_QUERY_KEY,
        });

        setAttachedFiles([]);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("errors.GENERIC");
        setFileError(message);
        setIsUploadingFiles(false);
        return;
      } finally {
        setIsUploadingFiles(false);
      }
    }

    sendMessage({
      content,
      conversationId: activeConversationId || undefined,
      collectionId: targetCollectionId,
    });
  };

  // Auto-scroll to bottom on streaming or new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.items, streamAnswer, isStreaming]);

  // Determine which citations to display in SourcePanel
  const displayedCitations: ChatCitation[] =
    streamCitations.length > 0
      ? streamCitations
      : activeCitation
        ? [activeCitation]
        : (messagesData?.items
            ?.slice()
            ?.reverse()
            ?.find((m) => m.role === "ASSISTANT" && m.citations && m.citations.length > 0)
            ?.citations as ChatCitation[]) || [];

  const conversationMessages = messagesData?.items || [];

  const handleExportMarkdown = () => {
    if (conversationMessages.length === 0) return;

    let md = `# DocMind — ${t("chat.title")}\n\n`;
    md += `*Ngày xuất: ${new Date().toLocaleString("vi-VN")}*\n\n---\n\n`;

    for (const msg of conversationMessages) {
      if (msg.role === "USER") {
        md += `### 👤 Người dùng:\n\n${msg.content}\n\n`;
      } else {
        md += `### 🤖 Trợ lý DocMind:\n\n${msg.content}\n\n`;
        if (msg.citations && msg.citations.length > 0) {
          md += `**Nguồn trích dẫn:**\n\n`;
          for (const c of msg.citations) {
            md += `- [${c.index}] **${c.filename}** (trang ${c.pageNumber || 1}) — Độ khớp: ${Math.round(c.score * 100)}%\n`;
          }
          md += `\n`;
        }
      }
      md += `---\n\n`;
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `docmind-conversation-${activeConversationId || "new"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen overflow-hidden bg-bg relative"
    >
      {/* Full-Window Drag and Drop Backdrop Overlay */}
      {isDraggingOverWindow && (
        <div
          className="absolute inset-0 z-40 bg-bg/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 pointer-events-none transition-all duration-200 animate-in fade-in-0"
          aria-hidden="true"
        >
          <div className="w-full max-w-xl h-72 border-2 border-dashed border-accent rounded-3xl bg-accent-soft/30 flex flex-col items-center justify-center gap-4 text-center p-6 shadow-lg">
            <div className="size-16 rounded-2xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent shadow-xs">
              <UploadCloud className="size-8 animate-bounce" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base sm:text-lg font-semibold text-fg">
                {t("chat.dragDropHeadline")}
              </p>
              <p className="text-xs text-fg-muted">
                {t("chat.dragDropHint")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Left Column: Conversation History Sidebar */}
      {/* Mobile Backdrop for left sidebar */}
      {showLeftSidebar && (
        <div
          onClick={() => setShowLeftSidebar(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-30 md:static md:z-auto transition-all duration-200 shrink-0 ${
          showLeftSidebar
            ? "w-72 sm:w-80 translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden"
        }`}
      >
        <ConversationList
          activeConversationId={activeConversationId}
          onToggleCollapse={() => setShowLeftSidebar(false)}
          onSelectConversation={(id) => {
            handleSelectConversation(id);
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setShowLeftSidebar(false);
            }
          }}
          onNewConversation={() => {
            handleNewConversation();
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setShowLeftSidebar(false);
            }
          }}
        />
      </div>

      {/* 2. Main Chat Thread Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-bg">
        {/* Top Chat Bar */}
        <div className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!showLeftSidebar && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowLeftSidebar(true)}
                title={t("common.openSidebar") || "Mở sidebar"}
                aria-label="Open sidebar"
                className="text-fg-muted hover:text-fg"
              >
                <PanelLeft className="size-4" />
              </Button>
            )}

            <span className="font-semibold text-xs sm:text-sm text-fg truncate">
              {activeConversationId ? t("chat.title") : t("chat.newConversation")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Export Markdown Button */}
            {conversationMessages.length > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleExportMarkdown}
                title={t("chat.exportMarkdown")}
                aria-label={t("chat.exportMarkdown")}
                className="text-fg-muted hover:text-fg"
              >
                <Download className="size-4" />
              </Button>
            )}

            {/* Toggle Source Citations Panel */}
            <Button
              variant={showSourcePanel ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSourcePanel((prev) => !prev)}
              className="text-xs gap-1.5 h-7 px-2"
            >
              <Bookmark className="size-3.5 text-accent" aria-hidden="true" />
              <span className="hidden sm:inline">{t("chat.citations")}</span>
              {displayedCitations.length > 0 && (
                <span className="font-mono text-2xs px-1.5 py-0.5 rounded-full bg-accent-soft text-accent leading-none">
                  {displayedCitations.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Messages Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* If fresh conversation with no messages yet */}
            {conversationMessages.length === 0 && !isStreaming && !pendingPrompt ? (
              collections.length === 0 && !isLoadingCollections ? (
                /* Onboarding state when user has zero collections/documents */
                <div className="text-center py-12 px-4 space-y-6 max-w-lg mx-auto">
                  <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-accent-soft text-accent border border-accent/20 shadow-xs">
                    <FolderPlus className="size-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl text-fg tracking-tight">
                      {t("chat.onboardingTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-fg-muted leading-relaxed max-w-md mx-auto">
                      {t("chat.onboardingSubtitle")}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col items-center gap-3">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate({ to: "/collections" })}
                      className="gap-2 shadow-xs"
                    >
                      <Upload className="size-4" aria-hidden="true" />
                      <span>{t("chat.onboardingUploadButton")}</span>
                    </Button>
                    <span className="text-2xs text-fg-muted">
                      {t("chat.onboardingBadge")}
                    </span>
                  </div>
                </div>
              ) : (
                /* Standard empty state with prompt starters */
                <div className="text-center py-12 px-4 space-y-6 max-w-xl mx-auto">
                  <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-accent-soft text-accent border border-accent/20 shadow-xs">
                    <Sparkles className="size-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl text-fg tracking-tight">
                      {t("chat.emptyChatTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-fg-muted leading-relaxed max-w-md mx-auto">
                      {t("chat.emptyChatSubtitle")}
                    </p>
                  </div>

                  {/* Prompt Starters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
                    {[
                      "Tóm tắt các chỉ số quan trọng trong tài liệu mới nhất",
                      "Phân tích dữ liệu doanh thu và tăng trưởng định kỳ",
                      "Kiểm tra các điều khoản pháp lý và bảo mật",
                      "Tìm kiếm các trích dẫn về quy trình vận hành",
                    ].map((starter, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(starter)}
                        className="p-3 rounded-xl border border-border bg-surface hover:border-accent hover:bg-accent-soft/20 text-xs text-fg-muted hover:text-fg transition-all duration-150 shadow-2xs group flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <Sparkles className="size-3.5 text-accent shrink-0 mt-0.5 group-hover:scale-110 transition-transform" aria-hidden="true" />
                        <span className="line-clamp-2 leading-relaxed">{starter}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : null}

            {/* Render persisted messages */}
            {conversationMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                role={msg.role}
                content={msg.content}
                citations={msg.citations}
                onCitationClick={handleCitationClick}
              />
            ))}

            {/* Render live pending user prompt while stream is initializing */}
            {isStreaming && pendingPrompt && (
              <ChatMessageItem role="USER" content={pendingPrompt} />
            )}

            {/* Render live assistant answer stream */}
            {isStreaming && (
              <ChatMessageItem
                role="ASSISTANT"
                content={streamAnswer}
                citations={streamCitations}
                rewrittenQuery={rewrittenQuery}
                isStreaming={isStreaming}
                error={streamError}
                onRetry={() => pendingPrompt && handleSend(pendingPrompt)}
                onCitationClick={handleCitationClick}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input pinned at bottom */}
        <ChatInput
          onSendMessage={handleSend}
          isStreaming={isStreaming}
          onStop={stopStreaming}
          disabled={isLoadingMessages}
          attachedFiles={attachedFiles}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
          isUploadingFiles={isUploadingFiles}
          fileError={fileError}
        />
      </div>

      {/* 3. Right Column: Source Citation Panel */}
      {showSourcePanel && (
        <>
          <div
            onClick={() => setShowSourcePanel(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-[88vw] bg-surface border-l border-border shadow-xl z-30 md:static md:shadow-none md:z-auto md:w-80 lg:w-96 shrink-0 h-full overflow-hidden transition-all duration-200">
            <SourcePanel
              citations={displayedCitations}
              activeCitationIndex={activeCitation?.index}
              onSelectCitation={(citation) => setActiveCitation(citation)}
              onViewDocument={(citation) => setViewingCitation(citation)}
              onClose={() => setShowSourcePanel(false)}
            />
          </div>
        </>
      )}

      {/* In-app Document Viewer Modal */}
      <DocumentViewerModal
        open={!!viewingCitation}
        onOpenChange={(open) => !open && setViewingCitation(null)}
        documentId={viewingCitation?.documentId ?? null}
        filename={viewingCitation?.filename ?? ""}
        initialPage={viewingCitation?.pageNumber}
        initialChunkIndex={viewingCitation?.chunkIndex}
      />
    </div>
  );
}
