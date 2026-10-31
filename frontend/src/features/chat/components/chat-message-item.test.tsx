import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ChatMessageItem } from "./chat-message-item";
import type { ChatCitation } from "../schemas/chat-schemas";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "chat.citations") return "Nguồn trích dẫn";
      if (key === "chat.searching") return "Đang tìm kiếm thông tin...";
      if (key === "chat.retryAnswer") return "Thử lại";
      if (key === "chat.copy") return "Sao chép câu trả lời";
      if (key === "chat.copied") return "Đã sao chép";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

const mockCitations: ChatCitation[] = [
  {
    index: 1,
    documentId: "doc-1",
    filename: "Bao_cao_Tai_chinh_Q3.pdf",
    chunkIndex: 2,
    pageNumber: 15,
    headingContext: "Doanh thu",
    score: 0.92,
    snippet: "Doanh thu quý 3 tăng trưởng 18.5%",
  },
];

describe("ChatMessageItem Component", () => {
  it("renders user message correctly", () => {
    render(<ChatMessageItem role="USER" content="Doanh thu Q3 bao nhiêu?" />);
    expect(screen.getByText("Doanh thu Q3 bao nhiêu?")).toBeInTheDocument();
  });

  it("renders assistant message with content and citations", () => {
    const handleCitationClick = vi.fn();
    render(
      <ChatMessageItem
        role="ASSISTANT"
        content="Theo báo cáo [1], doanh thu tăng mạnh."
        citations={mockCitations}
        onCitationClick={handleCitationClick}
      />
    );

    expect(screen.getByText(/doanh thu tăng mạnh/i)).toBeInTheDocument();

    const citationButtons = screen.getAllByRole("button", {
      name: /Bao_cao_Tai_chinh_Q3\.pdf/i,
    });
    expect(citationButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(citationButtons[0]);
    expect(handleCitationClick).toHaveBeenCalledWith(mockCitations[0]);
  });

  it("renders searching indicator when isStreaming and content is empty", () => {
    render(
      <ChatMessageItem
        role="ASSISTANT"
        content=""
        isStreaming={true}
      />
    );

    expect(screen.getByText("Đang tìm kiếm thông tin...")).toBeInTheDocument();
  });

  it("renders error alert with retry button when error is provided", () => {
    const handleRetry = vi.fn();
    render(
      <ChatMessageItem
        role="ASSISTANT"
        content="Một phần câu trả lời"
        error="Mất kết nối stream"
        onRetry={handleRetry}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Mất kết nối stream")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /Thử lại/i });
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("has zero accessibility violations for assistant message", async () => {
    const { container } = render(
      <ChatMessageItem
        role="ASSISTANT"
        content="Doanh thu đạt mức kỷ lục trong quý vừa qua."
        citations={mockCitations}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
