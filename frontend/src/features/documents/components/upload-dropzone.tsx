import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { UploadCloud, Loader2, AlertCircle } from "lucide-react";
import {
  ALLOWED_MIME_EXTENSIONS,
  MAX_DOCUMENT_SIZE,
  MAX_TABULAR_SIZE,
  type DocumentResponse,
} from "../schemas/document-schemas";
import { useUploadDocument } from "../hooks/use-documents";

interface UploadDropzoneProps {
  collectionId: string;
  onUploaded?: (doc: DocumentResponse, file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  collectionId,
  onUploaded,
  disabled = false,
}: UploadDropzoneProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState({ current: 0, total: 0 });

  const uploadMutation = useUploadDocument(collectionId);

  const validateFile = (file: File): string | null => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const isAllowed = ALLOWED_MIME_EXTENSIONS.some(
      (ext) => ext.toLowerCase() === extension
    );

    if (!isAllowed) {
      return t("documents.fileInvalidType", { name: file.name });
    }

    const isTabular = extension === ".xlsx" || extension === ".csv";
    const maxSize = isTabular ? MAX_TABULAR_SIZE : MAX_DOCUMENT_SIZE;
    const maxSizeMb = isTabular ? 10 : 50;

    if (file.size > maxSize) {
      return t("documents.fileTooLarge", {
        name: file.name,
        maxSize: maxSizeMb,
      });
    }

    return null;
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled || isUploading) return;

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of fileList) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    setValidationErrors(errors);

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadCount({ current: 0, total: validFiles.length });

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadCount({ current: i + 1, total: validFiles.length });
        try {
          const doc = await uploadMutation.mutateAsync(file);
          onUploaded?.(doc, file);
        } catch (uploadErr) {
          errors.push(
            `Lỗi khi tải lên ${file.name}: ${
              uploadErr instanceof Error ? uploadErr.message : "Thất bại"
            }`
          );
        }
      }
    } finally {
      setIsUploading(false);
      setValidationErrors([...errors]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!disabled && !isUploading && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all duration-200 text-center ${
          isDragOver
            ? "border-accent bg-accent-soft/60 shadow-inner ring-4 ring-accent/15 scale-[1.01]"
            : "border-border/90 bg-surface hover:border-accent/50 hover:bg-surface-muted/30"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_EXTENSIONS.join(",")}
          onChange={onFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
          id="document-file-input"
        />

        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent border border-accent/25 mb-3.5 shadow-2xs">
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          ) : (
            <UploadCloud className="size-6" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-1.5 max-w-md">
          <p className="text-sm font-medium text-fg">
            <span>{t("documents.dropzoneText")} </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="text-accent hover:underline font-semibold cursor-pointer focus:outline-hidden"
            >
              {t("documents.dropzoneBrowse")}
            </button>
          </p>
          <p className="text-xs text-fg-muted leading-relaxed">
            {t("documents.uploadDescription")}
          </p>
        </div>

        {/* Format Badges */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
          {["PDF", "DOCX", "PPTX", "XLSX", "CSV", "TXT", "MD"].map((fmt) => (
            <span
              key={fmt}
              className="px-2 py-0.5 rounded-md bg-surface-muted border border-border/80 text-2xs font-mono font-medium text-fg-muted"
            >
              {fmt}
            </span>
          ))}
        </div>

        {isUploading && (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-accent">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            <span>
              {t("documents.uploadingCount", {
                count: `${uploadCount.current}/${uploadCount.total}`,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-danger-soft text-danger border border-danger/20 text-xs space-y-1"
        >
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>Một số file không thể tải lên:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
