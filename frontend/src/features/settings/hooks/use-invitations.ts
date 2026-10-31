import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invitationsApi } from "../api/invitations-api";
import type {
  AcceptInvitationFormData,
  CreateInvitationFormData,
  InvitationInfoResponse,
  InvitationResponse,
  PendingInvitationItem,
} from "../schemas/invitation-schemas";
import type { TokensResponse } from "@/features/auth/api/auth-api";

export function usePendingInvitations(tenantId: string) {
  return useQuery<PendingInvitationItem[], Error>({
    queryKey: ["invitations", tenantId],
    queryFn: () => invitationsApi.listPending(tenantId),
    enabled: !!tenantId,
  });
}

export function useCreateInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation<InvitationResponse, Error, CreateInvitationFormData>({
    mutationFn: (dto) => invitationsApi.create(tenantId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", tenantId] });
    },
  });
}

export function useRevokeInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation<InvitationResponse, Error, string>({
    mutationFn: (invitationId) => invitationsApi.revoke(tenantId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", tenantId] });
    },
  });
}

export function useInvitationInfo(token: string) {
  return useQuery<InvitationInfoResponse, Error>({
    queryKey: ["invitations", "info", token],
    queryFn: () => invitationsApi.getByToken(token),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation(token: string) {
  return useMutation<TokensResponse, Error, AcceptInvitationFormData>({
    mutationFn: (dto) => invitationsApi.accept(token, dto),
  });
}
