import { apiClient } from "@/lib/api-client";
import type {
  AcceptInvitationFormData,
  CreateInvitationFormData,
  InvitationInfoResponse,
  InvitationResponse,
} from "../schemas/invitation-schemas";
import type { TokensResponse } from "@/features/auth/api/auth-api";
import { setAccessToken } from "@/lib/auth-token";

export const invitationsApi = {
  async create(
    tenantId: string,
    dto: CreateInvitationFormData
  ): Promise<InvitationResponse> {
    return apiClient<InvitationResponse>(`/tenants/${tenantId}/invitations`, {
      method: "POST",
      body: dto,
    });
  },

  async revoke(
    tenantId: string,
    invitationId: string
  ): Promise<InvitationResponse> {
    return apiClient<InvitationResponse>(
      `/tenants/${tenantId}/invitations/${invitationId}`,
      {
        method: "DELETE",
      }
    );
  },

  async getByToken(token: string): Promise<InvitationInfoResponse> {
    return apiClient<InvitationInfoResponse>(`/invitations/${token}`, {
      skipAuth: true,
    });
  },

  async accept(
    token: string,
    dto: AcceptInvitationFormData
  ): Promise<TokensResponse> {
    const data = await apiClient<TokensResponse>(`/invitations/${token}/accept`, {
      method: "POST",
      body: dto,
      skipAuth: true,
    });
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },
};
