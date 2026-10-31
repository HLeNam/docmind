import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  UploadCloud,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CollectionResponse } from "@/features/collections/schemas/collection-schemas";
import type { DocumentResponse } from "../schemas/document-schemas";
import {
  useDocuments,
  useDocumentRealtimeProgress,
} from "../hooks/use-documents";
import { UploadDropzone } from "./upload-dropzone";
import { UploadProgressList } from "./upload-progress-list";
import { DocumentTable } from "./document-table";
import { DeleteDocumentDialog } from "./delete-document-dialog";

interface CollectionFilesDialogProps {
  collection: CollectionResponse;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionFilesDialog({
  collection,
  canManage,
  open,
  onOpenChange,
}: CollectionFilesDialogProps) {
  const { t } = useTranslation();
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [filenamesMap, setFilenamesMap] = useState<Record<string, string>>({});
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // TanStack Query for documents list in this collection
  const {
    data: documents = [],
    isLoading,
    error,
    refetch,
  } = useDocuments(collection.id);

  // Realtime progress via Socket.IO
  const { progressMap, clearProgress } = useDocumentRealtimeProgress(
    collection.id
  );

  const handleDocumentUploaded = (doc: DocumentResponse, file: File) => {
    setFilenamesMap((prev) => ({
      ...prev,
      [doc.id]: file.name,
    }));
  };

  const handleDeleteRequest = (doc: DocumentResponse) => {
    setDocumentToDelete(doc);
    setIsDeleteDialogOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[88vh] max-h-200 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="shrink-0 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-4 pr-6">
            <div>
              <DialogTitle className="text-lg font-semibold text-fg flex items-center gap-2">
                <FileText className="size-5 text-accent" />
                <span>{t("documents.title")} — {collection.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-fg-muted mt-0.5">
                {t("documents.subtitle")}
              </DialogDescription>
            </div>

            {canManage && (
              <Button
                type="button"
                variant={showUploadZone ? "secondary" : "default"}
                size="sm"
                onClick={() => setShowUploadZone((prev) => !prev)}
                className="gap-1.5 shrink-0"
              >
                <UploadCloud className="size-4" aria-hidden="true" />
                <span>{showUploadZone ? t("common.cancel") : t("documents.uploadButton", { defaultValue: "Tải tài liệu lên" })}</span>
                {showUploadZone ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0 py-4 space-y-4 pr-1">
          {/* Upload Dropzone (Collapsible) */}
          {canManage && showUploadZone && (
            <div className="p-4 rounded-xl border border-dashed border-accent/40 bg-accent-soft/20 space-y-3">
              <UploadDropzone
                collectionId={collection.id}
                onUploaded={handleDocumentUploaded}
              />
              <UploadProgressList
                progressMap={progressMap}
                filenamesMap={filenamesMap}
                onDismiss={clearProgress}
              />
            </div>
          )}

          {/* Active upload progress if upload zone is closed */}
          {!showUploadZone && Object.keys(progressMap).length > 0 && (
            <UploadProgressList
              progressMap={progressMap}
              filenamesMap={filenamesMap}
              onDismiss={clearProgress}
            />
          )}

          {/* Document Table */}
          <DocumentTable
            documents={documents}
            collectionId={collection.id}
            canManage={canManage}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            progressMap={progressMap}
            onDeleteRequest={handleDeleteRequest}
            onUploadClick={() => setShowUploadZone(true)}
          />
        </div>

        {/* Footer info bar */}
        <div className="shrink-0 pt-3 border-t border-border flex items-center justify-between text-xs text-fg-muted">
          <div className="flex items-center gap-3">
            <span className="font-medium text-fg">{documents.length} {t("documents.title").toLowerCase()}</span>
            <span>•</span>
            <span className="text-2xs font-mono">{t("documents.processedAndStored")}</span>
          </div>
          <span className="text-2xs text-fg-muted font-mono">
            {t("collections.ragReady")}
          </span>
        </div>

        {/* Delete Document Dialog */}
        <DeleteDocumentDialog
          document={documentToDelete}
          collectionId={collection.id}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onDeleted={() => setDocumentToDelete(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
