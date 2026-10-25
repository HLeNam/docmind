import { getAccessToken, clearAccessToken } from "./auth-token";
import {
  refreshAccessTokenSingleFlight,
  AppError,
  RateLimitError,
} from "./api-client";
import type { SseChatEvent } from "@/features/chat/schemas/chat-schemas";

interface StreamSseOptions {
  url: string;
  body: unknown;
  signal?: AbortSignal;
  onEvent: (event: SseChatEvent) => void;
}

export async function fetchEventSourceStream({
  url,
  body,
  signal,
  onEvent,
}: StreamSseOptions): Promise<void> {
  let token = getAccessToken();

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });

  // Handle 401 Unauthorized single-flight retry
  if (response.status === 401) {
    const newToken = await refreshAccessTokenSingleFlight();
    if (!newToken) {
      clearAccessToken();
      throw new AppError("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn", 401);
    }
    token = newToken;
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      credentials: "include",
      signal,
    });
  }

  // Handle 429 Rate Limit
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") || 60);
    throw new RateLimitError(
      retryAfter,
      `Vượt quá giới hạn gửi tin nhắn. Vui lòng thử lại sau ${retryAfter} giây.`
    );
  }

  // Handle other HTTP errors
  if (!response.ok) {
    let errorCode = "HTTP_ERROR";
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorCode = errJson.error.code || errorCode;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // Non-JSON response
    }
    throw new AppError(errorCode, errorMessage, response.status);
  }

  if (!response.body) {
    throw new AppError("STREAM_ERROR", "Response body is empty", 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE blocks are delimited by two newlines
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        let eventType = "message";
        const dataLines: string[] = [];

        for (const line of trimmed.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        const rawData = dataLines.join("\n");

        if (eventType === "start") {
          try {
            const data = JSON.parse(rawData);
            onEvent({ type: "start", data });
          } catch {
            // Ignore malformed JSON
          }
        } else if (eventType === "delta") {
          onEvent({ type: "delta", data: rawData });
        } else if (eventType === "done") {
          try {
            const data = JSON.parse(rawData);
            onEvent({ type: "done", data });
          } catch {
            onEvent({ type: "done", data: { messageId: "" } });
          }
        } else if (eventType === "error") {
          try {
            const data = JSON.parse(rawData);
            onEvent({ type: "error", data });
          } catch {
            onEvent({ type: "error", data: { message: rawData } });
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
