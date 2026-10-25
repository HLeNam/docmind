import { fetchEventSourceStream } from "@/lib/sse";
import type {
  SendMessagePayload,
  SseChatEvent,
} from "../schemas/chat-schemas";

export const chatApi = {
  async sendMessageStream(
    payload: SendMessagePayload,
    signal: AbortSignal | undefined,
    onEvent: (event: SseChatEvent) => void
  ): Promise<void> {
    return fetchEventSourceStream({
      url: "/api/chat/messages",
      body: payload,
      signal,
      onEvent,
    });
  },
};
