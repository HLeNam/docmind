import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SourcePanel } from "./source-panel";
import type { ChatCitation } from "@/features/chat/schemas/chat-schemas";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "chat.citations": "Nguồn đối soát",
        "chat.noCitations": "Chưa có trích dẫn nguồn cho câu trả lời này.",
        "documents.viewer.viewOriginalFromCitation": "Xem trong tài liệu gốc",
        "common.cancel": "Đóng",
      };
      return translations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const sampleCitations: ChatCitation[] = [
  {
    index: 1,
    documentId: "doc-123",
    filename: "Bao_cao_Tai_chinh_Q3.pdf",
    chunkIndex: 0,
    pageNumber: 18,
    headingContext: "Ket qua kinh doanh",
    score: 0.94,
    snippet: "Doanh thu quý 3 đạt 128 tỷ VNĐ, tăng trưởng 24.6% so với cùng kỳ.",
  },
  {
    index: 2,
    documentId: "doc-456",
    filename: "Ke_hoach_Kinh_doanh.xlsx",
    chunkIndex: 2,
    pageNumber: null,
    headingContext: 'Sheet "Kế hoạch" · hàng 12',
    score: 0.88,
  },
];

describe("SourcePanel Component", () => {
  it("renders empty state when citations array is empty", () => {
    render(<SourcePanel citations={[]} />);
    expect(screen.getByText(/Chưa có trích dẫn nguồn/i)).toBeInTheDocument();
  });

  it("renders list of citations with filename, location, and snippet", () => {
    render(<SourcePanel citations={sampleCitations} />);
    expect(screen.getByText("Bao_cao_Tai_chinh_Q3.pdf")).toBeInTheDocument();
    expect(screen.getByText("Ke_hoach_Kinh_doanh.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Trang 18")).toBeInTheDocument();
    expect(
      screen.getByText(/"Doanh thu quý 3 đạt 128 tỷ VNĐ, tăng trưởng 24.6% so với cùng kỳ."/)
    ).toBeInTheDocument();
  });

  it("fires onSelectCitation when a citation card is clicked", () => {
    const handleSelect = vi.fn();
    render(<SourcePanel citations={sampleCitations} onSelectCitation={handleSelect} />);

    const firstCard = screen.getByText("Bao_cao_Tai_chinh_Q3.pdf").closest("[role='button']");
    expect(firstCard).toBeInTheDocument();
    fireEvent.click(firstCard!);

    expect(handleSelect).toHaveBeenCalledWith(sampleCitations[0]);
  });

  it("fires onViewDocument when 'Xem trong tài liệu gốc' button is clicked", () => {
    const handleView = vi.fn();
    render(<SourcePanel citations={sampleCitations} onViewDocument={handleView} />);

    const viewButtons = screen.getAllByText(/Xem trong tài liệu gốc/i);
    fireEvent.click(viewButtons[0]);

    expect(handleView).toHaveBeenCalledWith(sampleCitations[0]);
  });

  it("has 0 accessibility violations with axe", async () => {
    const { container } = render(<SourcePanel citations={sampleCitations} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
