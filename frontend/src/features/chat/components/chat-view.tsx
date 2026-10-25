import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  PanelLeftClose,
  PanelLeft,
  Bookmark,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourcePanel } from "@/components/domain/source-panel";
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

  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-bg">
      {/* 1. Left Column: Conversation History Sidebar */}
      <div
        className={`${
          showLeftSidebar ? "w-64 sm:w-72" : "w-0 hidden md:hidden"
        } shrink-0 transition-all duration-200 h-full overflow-hidden`}
      >
        <ConversationList
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
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

        {/* Messages Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* If fresh conversation with no messages yet */}
            {conversationMessages.length === 0 && !isStreaming && !pendingPrompt ? (
              <div className="text-center py-16 px-4 space-y-4 max-w-lg mx-auto">
                <div className="flex size-12 mx-auto items-center justify-center rounded-2xl bg-accent-soft text-accent border border-accent/20 shadow-xs">
                  <Sparkles className="size-6" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-lg text-fg tracking-tight">
                  {t("chat.emptyChatTitle")}
                </h3>
                <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
                  {t("chat.emptyChatSubtitle")}
                </p>
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
        <div className="w-80 sm:w-96 shrink-0 h-full overflow-hidden transition-all duration-200">
          <SourcePanel
            citations={displayedCitations}
            activeCitationIndex={activeCitation?.index}
            onSelectCitation={(citation) => setActiveCitation(citation)}
            onClose={() => setShowSourcePanel(false)}
          />
        </div>
      )}
    </div>
  );
}
