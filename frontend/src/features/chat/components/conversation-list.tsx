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
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.preview && c.preview.toLowerCase().includes(q))
    );
  }, [data?.items, searchQuery]);

  const groups = useMemo(
    () => groupConversationsByDate(filteredItems, t),
    [filteredItems, t]
  );

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border w-full">
      {/* Header & New Chat button */}
      <div className="p-3 border-b border-border space-y-2.5">
        <Button
          variant="default"
          size="sm"
          onClick={onNewConversation}
          className="w-full justify-start gap-2 shadow-xs"
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
            className="h-8 pl-8 text-xs bg-surface-muted/40"
          />
        </div>
      </div>

      {/* Conversations scroll area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-fg-muted">
            <MessageSquare className="size-6 mx-auto mb-2 text-fg-muted/40" />
            <p>{t("chat.emptyHistory")}</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <h4 className="px-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                {group.label}
              </h4>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const title = item.title || item.preview || t("chat.newConversation");

                  return (
                    <div
                      key={item.id}
                      className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-accent-soft text-accent font-medium"
                          : "text-fg hover:bg-surface-muted"
                      }`}
                      onClick={() => onSelectConversation(item.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <MessageSquare
                          className={`size-3.5 shrink-0 ${
                            isActive ? "text-accent" : "text-fg-muted"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate" title={title}>
                          {title}
                        </span>
                      </div>

                      <div
                        className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
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

      {/* Modals */}
      <RenameConversationDialog
        conversation={conversationToRename}
        open={!!conversationToRename}
        onOpenChange={(open) => !open && setConversationToRename(null)}
      />

      <DeleteConversationDialog
        conversation={conversationToDelete}
        open={!!conversationToDelete}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
        onDeleted={() => {
          if (conversationToDelete && activeConversationId === conversationToDelete.id) {
            onSelectConversation(null);
          }
        }}
      />
    </div>
  );
}
