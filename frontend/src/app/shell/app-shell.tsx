import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { useAuth } from "@/features/auth";
import { ConversationList } from "@/features/chat";
import { useUIStore } from "@/lib/ui-store";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const routerSearch = useRouterState({
    select: (s) => s.location.search,
  }) as { c?: string };

  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const activeConversationId = routerSearch.c || null;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-bg text-fg flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface border border-border text-fg shadow-xs animate-pulse">
            <DocMindLogo size={28} className="text-fg" />
          </div>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>{t("common.loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleSelectConversation = (id: string | null) => {
    navigate({
      to: "/",
      search: { c: id || undefined },
    });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewConversation = () => {
    navigate({
      to: "/",
      search: { c: undefined },
    });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg relative">
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Persistent Left Sidebar (Claude Style) */}
      <div
        className={`fixed inset-y-0 left-0 z-30 md:static md:z-auto transition-all duration-200 shrink-0 ${
          isSidebarOpen
            ? "w-72 sm:w-80 translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden"
        }`}
      >
        <ConversationList
          activeConversationId={activeConversationId}
          onToggleCollapse={toggleSidebar}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-bg relative">
        {children}
      </div>
    </div>
  );
}
