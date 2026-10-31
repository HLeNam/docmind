import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChatView } from "@/features/chat";

const homeSearchSchema = z.object({
  c: z.string().optional(),
  col: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => homeSearchSchema.parse(search),
  component: HomePageChat,
});

function HomePageChat() {
  const search = Route.useSearch();

  return (
    <main id="main-content" className="h-full w-full overflow-hidden">
      <ChatView
        initialConversationId={search.c}
        initialCollectionId={search.col}
        initialPrompt={search.q}
      />
    </main>
  );
}
