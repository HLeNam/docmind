import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersApi } from "../api/members-api";
import type { MemberItem, RemoveMemberResponse } from "../schemas/member-schemas";

export function useMembers() {
  return useQuery<MemberItem[], Error>({
    queryKey: ["members"],
    queryFn: () => membersApi.list(),
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation<
    MemberItem,
    Error,
    { memberId: string; role: "ADMIN" | "MEMBER" }
  >({
    mutationFn: ({ memberId, role }) => membersApi.updateRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation<RemoveMemberResponse, Error, string>({
    mutationFn: (memberId) => membersApi.remove(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
