import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CollectionCard } from "./collection-card";
import { useUIStore } from "@/lib/ui-store";
import type { CollectionResponse } from "../schemas/collection-schemas";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "collections.openCollection") return "Mở bộ sưu tập";
      if (key === "collections.pin") return "Ghim bộ sưu tập";
      if (key === "collections.unpin") return "Bỏ ghim";
      if (key === "documents.title") return "Tài liệu";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

const mockCollection: CollectionResponse = {
  id: "col-123",
  tenantId: "tenant-1",
  name: "Báo cáo Q3 2026",
  description: "Mô tả báo cáo kinh doanh",
  instructions: "Trả lời ngắn gọn",
  createdAt: "2026-09-15T08:00:00Z",
  _count: {
    documents: 5,
    conversations: 2,
  },
};

describe("CollectionCard Component", () => {
  beforeEach(() => {
    useUIStore.setState({
      pinnedCollectionIds: [],
    });
  });

  it("renders collection name, description, and document count", () => {
    render(
      <CollectionCard
        collection={mockCollection}
        canManage={true}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Báo cáo Q3 2026")).toBeInTheDocument();
    expect(screen.getByText("Mô tả báo cáo kinh doanh")).toBeInTheDocument();
    expect(screen.getByText(/5 tài liệu/i)).toBeInTheDocument();
  });

  it("triggers onSelect callback when clicking title button or card container", () => {
    const handleSelect = vi.fn();
    render(
      <CollectionCard
        collection={mockCollection}
        canManage={true}
        onSelect={handleSelect}
        onDelete={vi.fn()}
      />
    );

    const titleButton = screen.getByRole("button", { name: "Báo cáo Q3 2026" });
    fireEvent.click(titleButton);
    expect(handleSelect).toHaveBeenCalledWith(mockCollection);

    handleSelect.mockClear();
    const openButton = screen.getByRole("button", { name: /Mở bộ sưu tập/i });
    fireEvent.click(openButton);
    expect(handleSelect).toHaveBeenCalledWith(mockCollection);
  });

  it("toggles pin status in UI store when clicking pin button", () => {
    render(
      <CollectionCard
        collection={mockCollection}
        canManage={true}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const pinButton = screen.getByRole("button", { name: "Ghim bộ sưu tập" });
    fireEvent.click(pinButton);

    expect(useUIStore.getState().isPinned("col-123")).toBe(true);
  });

  it("has zero accessibility violations according to axe", async () => {
    const { container } = render(
      <CollectionCard
        collection={mockCollection}
        canManage={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
