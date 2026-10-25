import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { useAuth } from "@/features/auth";
import { ChatView } from "@/features/chat";

const homeSearchSchema = z.object({
  c: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => homeSearchSchema.parse(search),
  component: HomePageChat,
});

function HomePageChat() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg text-fg">
      <main id="main-content" className="h-full w-full overflow-hidden">
        <ChatView initialConversationId={search.c} />
      </main>
    </div>
  );
}
