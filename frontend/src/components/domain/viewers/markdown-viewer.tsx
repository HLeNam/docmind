import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarkdownViewerProps {
  content: string;
  filename: string;
}

export function MarkdownViewer({ content, filename }: MarkdownViewerProps) {
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="text-xs text-fg-muted font-mono truncate max-w-xs" title={filename}>
          {filename} ({content.split("\n").length} dòng)
        </span>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-surface-muted p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "preview"
                  ? "bg-surface text-fg shadow-2xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Eye className="size-3" />
              <span>Định dạng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "raw"
                  ? "bg-surface text-fg shadow-2xs"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Code className="size-3" />
              <span>Mã nguồn</span>
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="gap-1.5 text-xs text-fg-muted hover:text-fg"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-accent" />
                <span>Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Sao chép</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        {viewMode === "preview" ? (
          <div className="max-w-3xl mx-auto prose dark:prose-invert text-fg leading-relaxed text-sm select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="font-mono text-xs text-fg leading-relaxed whitespace-pre-wrap select-text max-w-4xl mx-auto">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
