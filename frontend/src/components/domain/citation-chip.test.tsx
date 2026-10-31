import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CitationChip } from "./citation-chip";
import type { ChatCitation } from "@/features/chat/schemas/chat-schemas";

const sampleCitation: ChatCitation = {
  index: 1,
  documentId: "doc-123",
  filename: "Bao_cao_Tai_chinh_Q3.pdf",
  chunkIndex: 0,
  pageNumber: 18,
  headingContext: "Ket qua kinh doanh",
  score: 0.94,
};

describe("CitationChip Component", () => {
  it("renders with correct index label and accessibility aria-label", () => {
    render(<CitationChip citation={sampleCitation} />);
    const button = screen.getByRole("button", {
      name: /Nguồn 1: Bao_cao_Tai_chinh_Q3\.pdf, trang 18/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("[1]");
  });

  it("fires onClick callback with citation data when clicked", () => {
    const handleClick = vi.fn();
    render(<CitationChip citation={sampleCitation} onClick={handleClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(sampleCitation);
  });

  it("applies active styling when isActive is true", () => {
    render(<CitationChip citation={sampleCitation} isActive={true} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("ring-2 ring-accent");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CitationChip citation={sampleCitation} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
