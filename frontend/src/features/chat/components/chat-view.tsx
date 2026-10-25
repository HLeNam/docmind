import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  PanelLeftClose,
  PanelLeft,
  Bookmark,
  Sparkles,
  Download,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SourcePanel } from "@/components/domain/source-panel";
import { DocumentViewerModal } from "@/components/domain/document-viewer-modal";
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId || null
  );

  const [showLeftSidebar, setShowLeftSidebar] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    return true;
  });
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);
  const [viewingCitation, setViewingCitation] = useState<ChatCitation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    },
  });

  // Keep active conversation id synchronized
  const handleSelectConversation = (id: string | null) => {
    setActiveConversationId(id);
    setStreamConvId(id);
    setActiveCitation(null);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setStreamConvId(null);
    setActiveCitation(null);
  };

  const handleCitationClick = (citation: ChatCitation) => {
    setActiveCitation(citation);
    setShowSourcePanel(true);
  };

  const handleSend = (content: string, collectionId?: string) => {
    sendMessage({
      content,
      conversationId: activeConversationId || undefined,
      collectionId,
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
    link.download = `docmind-chat-${activeConversationId || "export"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-bg relative">
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
        className={cn(
          "h-full overflow-hidden transition-all duration-200 z-30 shrink-0",
          "fixed inset-y-0 left-0 w-72 bg-surface border-r border-border shadow-xl md:static md:shadow-none md:z-auto",
          showLeftSidebar
            ? "translate-x-0 md:w-64 lg:w-72"
            : "-translate-x-full md:translate-x-0 md:w-0 md:hidden"
        )}
      >
        <ConversationList
          activeConversationId={activeConversationId}
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

      {/* 2. Middle Column: Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-bg">
        {/* Top Chat Bar */}
        <div className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowLeftSidebar((prev) => !prev)}
              title={showLeftSidebar ? "Thu gọn sidebar" : "Mở rộng sidebar"}
              aria-label="Toggle sidebar"
              className="text-fg-muted hover:text-fg"
            >
              {showLeftSidebar ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
            </Button>

            <span className="font-medium text-xs sm:text-sm text-fg truncate">
              {activeConversationId ? t("chat.title") : t("chat.newConversation")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Export Markdown Button */}
            {conversationMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportMarkdown}
                className="text-xs gap-1.5 h-7 px-2 text-fg-muted hover:text-fg"
                title={t("chat.exportMarkdown")}
                aria-label={t("chat.exportMarkdown")}
              >
                <Download className="size-3.5" aria-hidden="true" />
                <span className="hidden md:inline">{t("chat.exportMarkdown")}</span>
              </Button>
            )}

            {/* Source Panel Toggle */}
            <Button
              variant={showSourcePanel ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSourcePanel((prev) => !prev)}
              className="text-xs gap-1.5 h-7 px-2"
            >
              <Bookmark className="size-3.5 text-accent" aria-hidden="true" />
              <span className="hidden sm:inline">{t("chat.citations")}</span>
              {displayedCitations.length > 0 && (
                <span className="font-mono text-[10px] px-1 py-0.2 rounded-full bg-accent-soft text-accent">
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
