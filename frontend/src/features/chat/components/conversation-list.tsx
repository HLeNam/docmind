import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Folder,
  PanelLeftClose,
  Settings,
  LogOut,
  Filter,
  Check,
  ChevronDown,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth";
import { useCollections } from "@/features/collections";
import { SettingsDialog } from "@/features/settings";
import { useUIStore } from "@/lib/ui-store";
import type { ConversationItem } from "../schemas/conversation-schemas";
import { useConversations } from "../hooks/use-conversations";
import { DeleteConversationDialog } from "./delete-conversation-dialog";
import { RenameConversationDialog } from "./rename-conversation-dialog";

interface ConversationListProps {
  activeConversationId?: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewConversation: () => void;
  onToggleCollapse?: () => void;
}

interface GroupedConversations {
  label: string;
  items: ConversationItem[];
}

function groupConversationsByDate(
  conversations: ConversationItem[],
  t: (key: string) => string
): GroupedConversations[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const last7Days = today - 86400000 * 7;

  const groups: Record<string, ConversationItem[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: [],
  };

  for (const item of conversations) {
    const time = new Date(item.lastMessageAt || item.createdAt).getTime();
    if (time >= today) {
      groups.today.push(item);
    } else if (time >= yesterday) {
      groups.yesterday.push(item);
    } else if (time >= last7Days) {
      groups.last7Days.push(item);
    } else {
      groups.older.push(item);
    }
  }

  const result: GroupedConversations[] = [];
  if (groups.today.length > 0) {
    result.push({ label: t("chat.today"), items: groups.today });
  }
  if (groups.yesterday.length > 0) {
    result.push({ label: t("chat.yesterday"), items: groups.yesterday });
  }
  if (groups.last7Days.length > 0) {
    result.push({ label: t("chat.last7Days"), items: groups.last7Days });
  }
  if (groups.older.length > 0) {
    result.push({ label: t("chat.older"), items: groups.older });
  }

  return result;
}

export function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onToggleCollapse,
}: ConversationListProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { data: collections = [] } = useCollections();
  const pinnedCollectionIds = useUIStore((s) => s.pinnedCollectionIds);
  const pinnedCollections = useMemo(
    () => collections.filter((c) => pinnedCollectionIds.includes(c.id)),
    [collections, pinnedCollectionIds]
  );
  const [selectedFilterCollectionId, setSelectedFilterCollectionId] =
    useState<string | null>(null);
  const { data, isLoading } = useConversations(
    undefined,
    50,
    selectedFilterCollectionId || undefined
  );

  const selectedFilterCollection = useMemo(
    () => collections.find((c) => c.id === selectedFilterCollectionId),
    [collections, selectedFilterCollectionId]
  );

  const collectionsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collections) {
      map.set(c.id, c.name);
    }
    return map;
  }, [collections]);

  const [searchQuery, setSearchQuery] = useState("");
  const [conversationToRename, setConversationToRename] =
    useState<ConversationItem | null>(null);
  const [conversationToDelete, setConversationToDelete] =
    useState<ConversationItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.preview?.toLowerCase().includes(q)
    );
  }, [data?.items, searchQuery]);

  const groups = useMemo(
    () => groupConversationsByDate(filteredItems, t),
    [filteredItems, t]
  );

  return (
    <aside
      aria-label={t("chat.conversations")}
      className="flex flex-col h-full bg-surface-muted/30 border-r border-border w-full select-none"
    >
      {/* 1. Brand Header with Logo & Collapse button (ChatGPT style) */}
      <div className="h-12 px-3 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-surface/50">
        <Link to="/" className="flex items-center gap-2 outline-none group">
          <div className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border text-fg shadow-2xs group-hover:border-accent/40 transition-colors">
            <DocMindLogo size={18} className="text-fg" />
          </div>
          <span className="font-heading font-semibold text-sm text-fg tracking-tight">
            DocMind
          </span>
        </Link>

        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapse}
            title={t("common.closeSidebar")}
            aria-label={t("common.closeSidebar")}
            className="text-fg-muted hover:text-fg"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      {/* 2. Top Actions: New Chat, Search, & Collections Knowledge link */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onNewConversation}
          className="w-full justify-start gap-2 shadow-xs rounded-xl"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          <span>{t("chat.newConversation")}</span>
        </Button>

        {/* Quick link to Collections / Knowledge Base */}
        <Link
          to="/collections"
          className="flex items-center justify-between p-2 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted hover:border-accent/40 transition-all text-xs font-medium text-fg shadow-2xs group"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent shrink-0">
              <Folder className="size-3.5" aria-hidden="true" />
            </div>
            <span className="truncate">{t("collections.title")}</span>
          </div>
          {collections.length > 0 && (
            <span className="font-mono text-2xs px-1.5 py-0.5 rounded-full bg-surface-muted text-fg-muted border border-border/80 shrink-0">
              {collections.length}
            </span>
          )}
        </Link>

        {/* Pinned collections */}
        {pinnedCollections.length > 0 && (
          <div className="space-y-0.5 pt-0.5">
            <div className="px-1 text-2xs font-semibold text-fg-muted uppercase tracking-wider flex items-center justify-between">
              <span>{t("collections.pinned")}</span>
              <Pin className="size-3 text-fg-muted/60" />
            </div>
            {pinnedCollections.map((col) => (
              <Link
                key={col.id}
                to="/collections/$collectionId"
                params={{ collectionId: col.id }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-fg-muted hover:text-fg hover:bg-surface/60 transition-colors truncate group"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Folder className="size-3 text-accent shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                {col._count && (
                  <span className="font-mono text-2xs text-fg-muted/70 shrink-0">
                    {col._count.documents}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.search")}
            className="h-8 pl-8 text-xs bg-surface border-border/80 rounded-lg"
          />
        </div>

        {/* Filter by Collection Selector */}
        {collections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface border border-border/80 text-xs text-fg-muted hover:text-fg transition-colors cursor-pointer"
                />
              }
            >
              <div className="flex items-center gap-1.5 truncate min-w-0">
                <Filter className="size-3 text-accent shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {selectedFilterCollection
                    ? selectedFilterCollection.name
                    : t("chat.allCollections")}
                </span>
              </div>
              <ChevronDown className="size-3 text-fg-muted shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-60 overflow-y-auto">
              <DropdownMenuItem
                onClick={() => setSelectedFilterCollectionId(null)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span>{t("chat.allCollections")}</span>
                {!selectedFilterCollectionId && (
                  <Check className="size-3.5 text-accent" />
                )}
              </DropdownMenuItem>
              {collections.map((col) => {
                const isSelected = selectedFilterCollectionId === col.id;
                return (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => setSelectedFilterCollectionId(col.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="truncate">{col.name}</span>
                    {isSelected && <Check className="size-3.5 text-accent" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 3. Conversations scroll area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-fg-muted space-y-2">
            <div className="flex size-10 mx-auto items-center justify-center rounded-xl bg-surface-muted text-fg-muted/60">
              <MessageSquare className="size-5" aria-hidden="true" />
            </div>
            <p>{t("chat.emptyHistory")}</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <h4 className="px-2 text-2xs font-semibold text-fg-muted uppercase tracking-wider">
                {group.label}
              </h4>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const title = item.title || item.preview || t("chat.newConversation");

                  return (
                    <div
                      key={item.id}
                      className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-surface text-accent font-medium shadow-2xs border border-border"
                          : "text-fg-muted hover:bg-surface/60 hover:text-fg"
                      }`}
                      onClick={() => onSelectConversation(item.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-6">
                        <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{title}</span>
                        {item.collectionId && !selectedFilterCollectionId && collectionsMap.get(item.collectionId) && (
                          <span className="font-mono text-2xs px-1.5 py-0.5 rounded-sm bg-accent-soft text-accent truncate max-w-20 shrink-0 font-medium leading-none">
                            {collectionsMap.get(item.collectionId)}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Menu actions */}
                      <div
                        className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="flex size-6 items-center justify-center rounded-lg hover:bg-surface-muted text-fg-muted hover:text-fg"
                              />
                            }
                          >
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => setConversationToRename(item)}
                              className="text-xs gap-2 cursor-pointer"
                            >
                              <Pencil className="size-3.5" />
                              <span>{t("chat.renameConversation")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setConversationToDelete(item)}
                              className="text-xs gap-2 text-danger focus:text-danger cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                              <span>{t("chat.deleteConversation")}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Bottom Profile & Workspace Footer (ChatGPT style) */}
      {user && (
        <div className="p-2 border-t border-border bg-surface/80 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-surface-muted text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group"
                />
              }
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent border border-accent/20 font-semibold text-xs shrink-0">
                  {user.identity.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-fg truncate">
                    {user.identity.email}
                  </p>
                  <p className="text-2xs text-fg-muted font-mono truncate">
                    {user.tenant.name} • {user.membership.role}
                  </p>
                </div>
              </div>
              <MoreVertical className="size-3.5 text-fg-muted group-hover:text-fg shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 mb-1">
              <div className="px-2 py-1.5 border-b border-border text-xs">
                <p className="font-semibold text-fg truncate">{user.tenant.name}</p>
                <p className="text-2xs text-fg-muted font-mono">{user.membership.role}</p>
              </div>
              <DropdownMenuItem
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <Settings className="size-3.5 text-fg-muted" />
                <span>{t("settings.title")}</span>
              </DropdownMenuItem>
              <div className="px-2 py-1.5 flex items-center justify-between border-t border-border">
                <span className="text-xs text-fg-muted">{t("common.theme")}</span>
                <ThemeToggle />
              </div>
              <DropdownMenuItem
                onClick={() => logout()}
                className="flex items-center gap-2 text-xs text-danger focus:text-danger cursor-pointer border-t border-border"
              >
                <LogOut className="size-3.5" />
                <span>{t("auth.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Settings In-Context Modal */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      {/* Dialogs */}
      {conversationToRename && (
        <RenameConversationDialog
          conversation={conversationToRename}
          open={!!conversationToRename}
          onOpenChange={(open) => !open && setConversationToRename(null)}
        />
      )}

      {conversationToDelete && (
        <DeleteConversationDialog
          conversation={conversationToDelete}
          open={!!conversationToDelete}
          onOpenChange={(open) => !open && setConversationToDelete(null)}
          onDeleted={() => {
            if (activeConversationId === conversationToDelete.id) {
              onNewConversation();
            }
          }}
        />
      )}
    </aside>
  );
}
