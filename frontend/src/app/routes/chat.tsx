import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/chat")({
  component: () => <Navigate to="/" replace />,
});
