import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const acceptInviteSearchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search) => acceptInviteSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    if (search.token) {
      throw redirect({
        to: "/invitations/$token",
        params: { token: search.token },
        replace: true,
      });
    }
    throw redirect({
      to: "/login",
      replace: true,
    });
  },
});