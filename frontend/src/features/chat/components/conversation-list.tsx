import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConversationItem } from "../schemas/conversation-schemas";
import { useConversations } from "../hooks/use-conversations";
import { DeleteConversationDialog } from "./delete-conversation-dialog";
import { RenameConversationDialog } from "./rename-conversation-dialog";

interface ConversationListProps {
  activeConversationId?: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewConversation: () => void;
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
}: ConversationListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useConversations();

  const [searchQuery, setSearchQuery] = useState("");
  const [conversationToRename, setConversationToRename] =
    useState<ConversationItem | null>(null);
  const [conversationToDelete, setConversationToDelete] =
    useState<ConversationItem | null>(null);

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
      {/* Top action: New Chat button & Search */}
      <div className="p-3 border-b border-border space-y-2">
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
      </div>

      {/* Conversations scroll area */}
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
                      className="group relative flex items-center rounded-xl transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectConversation(item.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                          isActive
                            ? "bg-surface text-fg font-medium shadow-2xs border border-border"
                            : "text-fg-muted hover:text-fg hover:bg-surface-muted/60"
                        }`}
                      >
                        <MessageSquare
                          className={`size-3.5 shrink-0 ${
                            isActive ? "text-accent" : "text-fg-muted"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate flex-1 pr-6" title={title}>
                          {title}
                        </span>
                      </button>

                      <div className="absolute right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-6 text-fg-muted hover:text-fg"
                                aria-label="Thao tác"
                              />
                            }
                          >
                            <MoreVertical className="size-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setConversationToRename(item)}
                            >
                              <Pencil className="size-3.5 mr-2" aria-hidden="true" />
                              <span>{t("chat.renameConversation")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConversationToDelete(item)}
                            >
                              <Trash2 className="size-3.5 mr-2" aria-hidden="true" />
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