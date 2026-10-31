import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Folder,
  Pin,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  Sparkles,
  ArrowUp,
  MessageSquare,
  Clock,
  ArrowLeft,
  PanelLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentStatusBadge } from "@/components/domain/document-status-badge";
import { useAuth } from "@/features/auth";
import { useUIStore } from "@/lib/ui-store";
import {
  useCollection,
  EditCollectionDialog,
  DeleteCollectionDialog,
} from "@/features/collections";
import {
  useDocuments,
  CollectionFilesDialog,
} from "@/features/documents";
import { useConversations } from "@/features/chat/hooks/use-conversations";

export const Route = createFileRoute("/collections/$collectionId")({
  component: CollectionWorkspacePage,
});

function CollectionWorkspacePage() {
  const { t } = useTranslation();
  const { collectionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const pinnedCollectionIds = useUIStore((s) => s.pinnedCollectionIds);
  const togglePinCollection = useUIStore((s) => s.togglePinCollection);
  const isPinned = pinnedCollectionIds.includes(collectionId);

  const [promptText, setPromptText] = useState("");
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Queries
  const { data: collection, isLoading: isLoadingCollection } =
    useCollection(collectionId);
  const { data: documents = [], isLoading: isLoadingDocuments } =
    useDocuments(collectionId);
  const { data: conversationsData, isLoading: isLoadingConversations } =
    useConversations(undefined, 20, collectionId);

  if (!user) {
    return null;
  }

  const canManage =
    user.membership.role === "OWNER" || user.membership.role === "ADMIN";

  const handleStartSession = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed) return;

    navigate({
      to: "/",
      search: {
        col: collectionId,
        q: trimmed,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStartSession();
    }
  };

  if (isLoadingCollection) {
    return (
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <Folder className="size-12 text-fg-muted/40" />
        <h2 className="text-lg font-semibold text-fg">
          {t("collections.notFound")}
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/collections" })}>
          <ArrowLeft className="size-4 mr-2" />
          <span>{t("collections.backToList")}</span>
        </Button>
      </div>
    );
  }

  const recentConversations = conversationsData?.items || [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-bg text-fg">
      {/* 1. Top Breadcrumb Bar */}
      <header className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/40 backdrop-blur-xs sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={toggleSidebar}
            className="md:hidden text-fg-muted hover:text-fg"
            aria-label={t("common.openSidebar")}
          >
            <PanelLeft className="size-4" />
          </Button>

          <Link
            to="/collections"
            className="text-xs font-medium text-fg-muted hover:text-fg transition-colors"
          >
            {t("collections.title")}
          </Link>
          <span className="text-fg-muted/40 text-xs">/</span>
          <span className="text-xs font-semibold text-fg truncate max-w-[200px] sm:max-w-xs">
            {collection.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin Toggle Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => togglePinCollection(collection.id)}
            title={isPinned ? t("collections.unpin") : t("collections.pin")}
            aria-label={isPinned ? t("collections.unpin") : t("collections.pin")}
            className={`size-8 transition-colors ${
              isPinned ? "text-accent fill-accent" : "text-fg-muted hover:text-fg"
            }`}
          >
            <Pin className={`size-4 ${isPinned ? "fill-accent" : ""}`} />
          </Button>

          {/* Manage Menu */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 text-fg-muted hover:text-fg"
                    aria-label={t("collections.actions")}
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => setIsEditDialogOpen(true)}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Pencil className="size-3.5" />
                  <span>{t("collections.edit")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>{t("collections.deleteTitle")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* 2. Main Workspace Layout: Center + Right Knowledge Column */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Center Column: Title, Prompt Card, and Recents (col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Header info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent border border-accent/20 shadow-xs">
                  <Folder className="size-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-fg">
                    {collection.name}
                  </h1>
                  <p className="text-xs text-fg-muted mt-0.5">
                    {t("collections.docStats", {
                      docs: documents.length,
                      sessions: recentConversations.length,
                    })}
                  </p>
                </div>
              </div>

              {collection.description && (
                <p className="text-sm text-fg-muted leading-relaxed text-pretty pt-1">
                  {collection.description}
                </p>
              )}
            </div>

            {/* Prompt Card (Claude Style "New session in Project") */}
            <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-sm space-y-3 focus-within:border-accent/60 transition-colors">
              <div className="flex items-center gap-2 text-xs font-medium text-fg">
                <Sparkles className="size-4 text-accent" />
                <span>{t("collections.promptTitle", { name: collection.name })}</span>
              </div>

              <div className="relative">
                <Textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("collections.promptPlaceholder", { name: collection.name })}
                  rows={3}
                  className="resize-none border-0 shadow-none bg-surface-muted/40 focus-visible:ring-0 text-sm p-3 rounded-xl pr-12"
                />

                <Button
                  type="button"
                  variant="default"
                  size="icon-xs"
                  disabled={!promptText.trim()}
                  onClick={() => handleStartSession()}
                  aria-label={t("chat.send")}
                  className="absolute bottom-2.5 right-2.5 size-7 rounded-lg transition-transform active:scale-95 shadow-xs"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between text-2xs text-fg-muted pt-1">
                <span>{t("collections.promptHint")}</span>
                <span className="font-mono">{t("collections.promptKeyboardHint")}</span>
              </div>
            </div>

            {/* Recents Sessions Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <Clock className="size-4 text-fg-muted" />
                  <span>{t("collections.recentSessions")}</span>
                </h3>
              </div>

              {isLoadingConversations ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : recentConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-fg-muted border border-dashed border-border rounded-2xl bg-surface/40 space-y-2">
                  <MessageSquare className="size-6 mx-auto text-fg-muted/60" />
                  <p>{t("collections.emptyRecent")}</p>
                  <p className="text-2xs text-fg-muted/70">
                    {t("collections.emptyRecentHint")}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() =>
                        navigate({
                          to: "/",
                          search: { c: conv.id },
                        })
                      }
                      className="group flex items-center justify-between p-3 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted/60 hover:border-accent/40 transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-fg-muted group-hover:text-accent group-hover:bg-accent-soft shrink-0 transition-colors">
                          <MessageSquare className="size-3.5" />
                        </div>
                        <span className="text-xs font-medium text-fg truncate">
                          {conv.title || conv.preview || t("chat.newConversation")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-2xs text-fg-muted shrink-0 font-mono">
                        <span>
                          {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString("vi-VN", {
                            month: "numeric",
                            day: "numeric",
                          })}
                        </span>
                        <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Project Knowledge Panel (col-span-4) */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. Files & Knowledge Card */}
            <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-fg">
                  <FileText className="size-4 text-accent" />
                  <span>{t("collections.sourceDocuments")} ({documents.length})</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsFilesDialogOpen(true)}
                  className="text-xs text-accent hover:underline p-0 h-auto font-medium"
                >
                  {t("collections.manageDocuments")}
                </Button>
              </div>

              <p className="text-2xs text-fg-muted leading-relaxed">
                {t("collections.knowledgeHint")}
              </p>

              {/* Top files preview */}
              {isLoadingDocuments ? (
                <div className="space-y-1.5 pt-1">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="p-4 text-center text-xs text-fg-muted bg-surface-muted/50 rounded-xl space-y-2 border border-dashed border-border">
                  <p>{t("collections.emptyDocsShort")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setIsFilesDialogOpen(true)}
                    className="text-xs"
                  >
                    {t("collections.uploadNow")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {documents.slice(0, 4).map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setIsFilesDialogOpen(true)}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-muted/40 hover:bg-surface-muted border border-border/50 text-xs transition-colors cursor-pointer"
                    >
                      <span className="truncate pr-2 font-medium text-fg text-2xs">
                        {doc.filename}
                      </span>
                      <DocumentStatusBadge status={doc.status} />
                    </div>
                  ))}

                  {documents.length > 4 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsFilesDialogOpen(true)}
                      className="w-full text-2xs text-fg-muted hover:text-fg pt-1"
                    >
                      <span>{t("collections.viewMoreDocs", { count: documents.length - 4 })}</span>
                      <ChevronRight className="size-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 2. Custom AI Instructions Card */}
            <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-fg">
                  <Sparkles className="size-4 text-accent" />
                  <span>{t("collections.instructions")}</span>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="text-xs text-accent hover:underline p-0 h-auto font-medium"
                  >
                    {t("common.save") ? "Chỉnh sửa" : "Edit"}
                  </Button>
                )}
              </div>

              <div className="text-xs text-fg-muted leading-relaxed bg-surface-muted/40 p-3 rounded-xl border border-border/60">
                {collection.instructions ? (
                  <p className="whitespace-pre-wrap text-fg text-2xs italic">
                    "{collection.instructions}"
                  </p>
                ) : (
                  <p className="italic text-2xs text-fg-muted/70">
                    {t("collections.instructionsEmpty")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <CollectionFilesDialog
        collection={collection}
        canManage={canManage}
        open={isFilesDialogOpen}
        onOpenChange={setIsFilesDialogOpen}
      />

      <EditCollectionDialog
        collection={collection}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <DeleteCollectionDialog
        collection={collection}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => navigate({ to: "/collections" })}
      />
    </div>
  );
}
