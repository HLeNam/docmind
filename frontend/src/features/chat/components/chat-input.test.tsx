import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ChatInput } from "./chat-input";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "chat.inputPlaceholder") return "Hỏi về tài liệu của bạn...";
      if (key === "chat.send") return "Gửi";
      if (key === "chat.stop") return "Dừng tạo câu trả lời";
      if (key === "chat.allCollections") return "Tất cả tài liệu";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

vi.mock("@/features/collections", () => ({
  useCollections: () => ({
    data: [
      { id: "col-1", name: "Tài chính 2026" },
      { id: "col-2", name: "Nhân sự & Chính sách" },
    ],
  }),
}));

describe("ChatInput Component", () => {
  it("renders textarea with placeholder and disabled send button when empty", () => {
    render(
      <ChatInput
        onSendMessage={vi.fn()}
        isStreaming={false}
        onStop={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Hỏi về tài liệu của bạn...");
    expect(textarea).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: "Gửi" });
    expect(sendButton).toBeDisabled();
  });

  it("submits message when typing text and clicking send button", () => {
    const handleSend = vi.fn();
    render(
      <ChatInput
        onSendMessage={handleSend}
        isStreaming={false}
        onStop={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Hỏi về tài liệu của bạn...");
    fireEvent.change(textarea, { target: { value: "Doanh thu Q3 là bao nhiêu?" } });

    const sendButton = screen.getByRole("button", { name: "Gửi" });
    expect(sendButton).toBeEnabled();

    fireEvent.click(sendButton);
    expect(handleSend).toHaveBeenCalledWith("Doanh thu Q3 là bao nhiêu?", undefined);
    expect(textarea).toHaveValue("");
  });

  it("submits message when pressing Enter without Shift", () => {
    const handleSend = vi.fn();
    render(
      <ChatInput
        onSendMessage={handleSend}
        isStreaming={false}
        onStop={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Hỏi về tài liệu của bạn...");
    fireEvent.change(textarea, { target: { value: "Câu hỏi test bàn phím" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith("Câu hỏi test bàn phím", undefined);
  });

  it("does not submit message when pressing Shift+Enter", () => {
    const handleSend = vi.fn();
    render(
      <ChatInput
        onSendMessage={handleSend}
        isStreaming={false}
        onStop={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Hỏi về tài liệu của bạn...");
    fireEvent.change(textarea, { target: { value: "Dòng 1" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it("displays stop button when isStreaming is true and triggers onStop", () => {
    const handleStop = vi.fn();
    render(
      <ChatInput
        onSendMessage={vi.fn()}
        isStreaming={true}
        onStop={handleStop}
      />
    );

    const stopButton = screen.getByRole("button", { name: "Dừng tạo câu trả lời" });
    expect(stopButton).toBeInTheDocument();

    fireEvent.click(stopButton);
    expect(handleStop).toHaveBeenCalledTimes(1);
  });

  it("has zero accessibility violations", async () => {
    const { container } = render(
      <ChatInput
        onSendMessage={vi.fn()}
        isStreaming={false}
        onStop={vi.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
