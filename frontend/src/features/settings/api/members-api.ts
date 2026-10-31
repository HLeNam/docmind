import { apiClient } from "@/lib/api-client";
import type { MemberItem, RemoveMemberResponse } from "../schemas/member-schemas";

export const membersApi = {
  async list(): Promise<MemberItem[]> {
    return apiClient<MemberItem[]>("/members");
  },

  async updateRole(
    memberId: string,
    role: "ADMIN" | "MEMBER"
  ): Promise<MemberItem> {
    return apiClient<MemberItem>(`/members/${memberId}`, {
      method: "PATCH",
      body: { role },
    });
  },

  async remove(memberId: string): Promise<RemoveMemberResponse> {
    return apiClient<RemoveMemberResponse>(`/members/${memberId}`, {
      method: "DELETE",
    });
  },
};
