import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { AppHeader } from "@/app/shell/app-header";
import { useAuth } from "@/features/auth";
import { ChatView } from "@/features/chat";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6">
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

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <AppHeader activeTab="chat" />

      {/* Main Chat Workspace */}
      <main id="main-content" className="flex-1 overflow-hidden">
        <ChatView />
      </main>
    </div>
  );
}
