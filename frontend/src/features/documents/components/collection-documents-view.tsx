import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpen,
  ArrowLeft,
  UploadCloud,
} from "lucide-react";
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

interface CollectionDocumentsViewProps {
  collection: CollectionResponse;
  canManage: boolean;
  onBack: () => void;
}

export function CollectionDocumentsView({
  collection,
  canManage,
  onBack,
}: CollectionDocumentsViewProps) {
  const { t } = useTranslation();
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [filenamesMap, setFilenamesMap] = useState<Record<string, string>>({});
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // TanStack Query for documents list in this collection
  const {
    data: documents,
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
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-fg-muted mb-1">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-fg hover:underline cursor-pointer flex items-center gap-1 focus:outline-hidden"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              <span>{t("collections.title")}</span>
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-fg font-medium truncate max-w-xs">{collection.name}</span>
          </nav>

          <h1 className="text-2xl font-semibold text-fg tracking-tight flex items-center gap-2.5">
            <FolderOpen className="size-6 text-accent" aria-hidden="true" />
            <span>{collection.name}</span>
          </h1>

          {collection.description && (
            <p className="text-sm text-fg-muted max-w-2xl">
              {collection.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <Button variant="outline" size="sm" onClick={onBack}>
            <span>Quay lại</span>
          </Button>

          {canManage && (
            <Button
              variant={showUploadZone ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowUploadZone((prev) => !prev)}
            >
              <UploadCloud className="size-4 mr-1.5" aria-hidden="true" />
              <span>{t("documents.upload")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Upload Dropzone (if active or if canManage & toggled) */}
      {canManage && showUploadZone && (
        <div className="p-4 rounded-xl border border-border bg-surface-muted/30">
          <UploadDropzone
            collectionId={collection.id}
            onUploaded={handleDocumentUploaded}
          />
        </div>
      )}

      {/* Realtime progress list for actively processed documents */}
      <UploadProgressList
        progressMap={progressMap}
        filenamesMap={filenamesMap}
        onDismiss={clearProgress}
      />

      {/* Documents Table */}
      <DocumentTable
        documents={documents}
        collectionId={collection.id}
        canManage={canManage}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        progressMap={progressMap}
        onDeleteRequest={handleDeleteRequest}
        onUploadClick={() => setShowUploadZone(true)}
      />

      {/* Delete Document Dialog */}
      <DeleteDocumentDialog
        document={documentToDelete}
        collectionId={collection.id}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => setDocumentToDelete(null)}
      />
    </div>
  );
}
