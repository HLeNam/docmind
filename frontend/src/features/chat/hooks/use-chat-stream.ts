import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../api/chat-api";
import type {
  ChatCitation,
  SendMessagePayload,
} from "../schemas/chat-schemas";
import { getMessagesQueryKey } from "./use-chat-messages";
import { CONVERSATIONS_QUERY_KEY } from "./use-conversations";

interface UseChatStreamOptions {
  onConversationCreated?: (newId: string) => void;
}

export function useChatStream({ onConversationCreated }: UseChatStreamOptions = {}) {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [streamAnswer, setStreamAnswer] = useState("");
  const [streamCitations, setStreamCitations] = useState<ChatCitation[]>([]);
  const [rewrittenQuery, setRewrittenQuery] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (payload: SendMessagePayload) => {
      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setPendingPrompt(payload.content);
      setStreamAnswer("");
      setStreamCitations([]);
      setRewrittenQuery(null);
      setStreamError(null);

      let targetConversationId = payload.conversationId || activeConversationId;

      try {
        await chatApi.sendMessageStream(
          {
            ...payload,
            conversationId: targetConversationId || undefined,
          },
          controller.signal,
          (event) => {
            if (event.type === "start") {
              const newConvId = event.data.conversationId;
              targetConversationId = newConvId;
              setActiveConversationId(newConvId);
              setStreamCitations(event.data.citations || []);
              setRewrittenQuery(event.data.rewrittenQuery);

              if (!payload.conversationId) {
                onConversationCreated?.(newConvId);
                queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
              }
            } else if (event.type === "delta") {
              setStreamAnswer((prev) => prev + event.data);
            } else if (event.type === "done") {
              setIsStreaming(false);
              setPendingPrompt(null);
              setStreamAnswer("");
              setStreamCitations([]);
              setRewrittenQuery(null);

              if (targetConversationId) {
                queryClient.invalidateQueries({
                  queryKey: getMessagesQueryKey(targetConversationId),
                });
                queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
              }
            } else if (event.type === "error") {
              setIsStreaming(false);
              setStreamError(event.data.message || "Lỗi trong quá trình tạo câu trả lời.");
            }
          }
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsStreaming(false);
          return;
        }
        setIsStreaming(false);
        setStreamError(
          err instanceof Error
            ? err.message
            : "Không thể kết nối đến máy chủ stream"
        );
      }
    },
    [activeConversationId, onConversationCreated, queryClient]
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const resetStream = useCallback(() => {
    stopStreaming();
    setStreamAnswer("");
    setStreamCitations([]);
    setRewrittenQuery(null);
    setStreamError(null);
    setPendingPrompt(null);
  }, [stopStreaming]);

  return {
    isStreaming,
    activeConversationId,
    setActiveConversationId,
    pendingPrompt,
    streamAnswer,
    streamCitations,
    rewrittenQuery,
    streamError,
    sendMessage,
    stopStreaming,
    resetStream,
  };
}
