import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentViewerModal } from "./document-viewer-modal";

// Mock URL.createObjectURL and revokeObjectURL
if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn(() => "blob:http://localhost:5173/mock-file");
  window.URL.revokeObjectURL = vi.fn();
}

vi.mock("@/features/documents/hooks/use-documents", () => ({
  useDocumentFile: () => ({
    data: {
      blob: new Blob(["Hello test"], { type: "text/plain" }),
      filename: "test.pdf",
      mimeType: "application/pdf",
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDocumentChunks: () => ({
    data: [
      {
        id: "chk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        pageNumber: 1,
        headingContext: "Introduction",
        content: "This is test chunk content.",
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("DocumentViewerModal", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("does not render content when closed", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentViewerModal
          open={false}
          onOpenChange={vi.fn()}
          documentId="doc-1"
          filename="test.pdf"
        />
      </QueryClientProvider>
    );

    expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
  });

  it("renders document title and file tabs when open", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentViewerModal
          open={true}
          onOpenChange={vi.fn()}
          documentId="doc-1"
          filename="test.pdf"
          initialPage={2}
        />
      </QueryClientProvider>
    );

    const headings = screen.getAllByRole("heading", { level: 2, name: /test\.pdf/i });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
