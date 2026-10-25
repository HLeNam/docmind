import { useState, useMemo, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Copy, Check, RefreshCw, AlertCircle, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { CitationChip } from "@/components/domain/citation-chip";
import type { ChatCitation } from "../schemas/chat-schemas";

interface ChatMessageItemProps {
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: ChatCitation[] | null;
  rewrittenQuery?: string | null;
  isStreaming?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCitationClick?: (citation: ChatCitation) => void;
}

export function ChatMessageItem({
  role,
  content,
  citations,
  rewrittenQuery,
  isStreaming = false,
  error,
  onRetry,
  onCitationClick,
}: ChatMessageItemProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const citationsMap = useMemo(() => {
    const map = new Map<number, ChatCitation>();
    if (citations) {
      for (const c of citations) {
        map.set(c.index, c);
      }
    }
    return map;
  }, [citations]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  };

  // Custom text transformer that converts [1], [2] to <CitationChip />
  const renderTextWithCitations = useCallback(
    (text: string): ReactNode => {
      const regex = /\[(\d+)\]/g;
      const parts: ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          parts.push(text.substring(lastIndex, matchIndex));
        }

        const citationNum = parseInt(match[1], 10);
        const citation = citationsMap.get(citationNum);

        if (citation) {
          parts.push(
            <CitationChip
              key={`cite-${citationNum}-${matchIndex}`}
              citation={citation}
              onClick={onCitationClick}
            />
          );
        } else {
          parts.push(match[0]);
        }

        lastIndex = matchIndex + match[0].length;
      }

      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts;
    },
    [citationsMap, onCitationClick]
  );

  // Custom markdown components to intercept text and attach citations
  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => {
        return (
          <p className="mb-3 last:mb-0 leading-relaxed text-fg">
            {Array.isArray(children)
              ? children.map((child, idx) =>
                  typeof child === "string" ? (
                    <span key={idx}>{renderTextWithCitations(child)}</span>
                  ) : (
                    child
                  )
                )
              : typeof children === "string"
                ? renderTextWithCitations(children)
                : children}
          </p>
        );
      },
      li: ({ children }: { children?: ReactNode }) => {
        return (
          <li className="mb-1 leading-relaxed text-fg">
            {Array.isArray(children)
              ? children.map((child, idx) =>
                  typeof child === "string" ? (
                    <span key={idx}>{renderTextWithCitations(child)}</span>
                  ) : (
                    child
                  )
                )
              : typeof children === "string"
                ? renderTextWithCitations(children)
                : children}
          </li>
        );
      },
    }),
    [renderTextWithCitations]
  );

  // 1. User Message
  if (role === "USER") {
    return (
      <div className="flex gap-3 justify-end group py-2">
        <div className="max-w-2xl rounded-2xl rounded-tr-xs bg-accent text-accent-fg px-4 py-2.5 text-sm shadow-xs font-normal">
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-surface border border-border text-fg-muted shadow-2xs mt-0.5">
          <User className="size-4" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // 2. Assistant Message
  return (
    <div className="flex gap-3 group py-3">
      {/* AI Avatar */}
      <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-surface border border-border text-accent shadow-2xs mt-0.5">
        <DocMindLogo size={16} className="text-accent" />
      </div>

      <div className="flex-1 max-w-[68ch] min-w-0 space-y-2.5">
        {/* Rewritten query indicator */}
        {rewrittenQuery && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-muted/70 text-[11px] text-fg-muted border border-border/70 mb-1">
            <Sparkles className="size-3 text-accent shrink-0" aria-hidden="true" />
            <span className="font-medium">{t("chat.rewrittenQueryNotice")}</span>
            <span className="italic text-fg font-medium">"{rewrittenQuery}"</span>
          </div>
        )}

        {/* Markdown Content */}
        <div className="text-sm prose prose-neutral dark:prose-invert max-w-none">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <span className="text-xs text-fg-muted italic flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-accent animate-ping" />
              <span>{t("chat.searching")}</span>
            </span>
          ) : null}

          {/* Streaming blinking cursor */}
          {isStreaming && content && (
            <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse ml-1 align-baseline" />
          )}
        </div>

        {/* Cited Sources Strip below assistant answer */}
        {!isStreaming && citations && citations.length > 0 && (
          <div className="pt-2.5 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-medium text-fg-muted flex items-center gap-1.5">
              <FileText className="size-3 text-accent" aria-hidden="true" />
              <span>{t("chat.citations")}:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c) => (
                <button
                  key={c.index}
                  type="button"
                  onClick={() => onCitationClick?.(c)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 bg-surface hover:bg-surface-muted hover:border-accent/50 text-[11px] text-fg transition-all text-left shadow-2xs group/cite focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <span className="font-mono font-semibold text-accent">[{c.index}]</span>
                  <span className="truncate max-w-[140px] font-medium">{c.filename}</span>
                  {c.pageNumber && (
                    <span className="text-fg-muted text-[10px]">p.{c.pageNumber}</span>
                  )}
                  <span className="text-accent text-[10px] font-mono font-medium ml-0.5">
                    {Math.round(c.score * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error during stream */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-danger-soft border border-danger/20 text-xs text-danger flex items-center justify-between gap-3 mt-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                size="xs"
                onClick={onRetry}
                className="shrink-0 text-danger border-danger/30 hover:bg-danger/10"
              >
                <RefreshCw className="size-3 mr-1" aria-hidden="true" />
                <span>{t("chat.retryAnswer")}</span>
              </Button>
            )}
          </div>
        )}

        {/* Action Bar (Copy) */}
        {!isStreaming && content && (
          <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              className="text-fg-muted hover:text-fg size-6"
              title={copied ? t("chat.copied") : t("chat.copy")}
              aria-label={t("chat.copy")}
            >
              {copied ? (
                <Check className="size-3 text-success" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
