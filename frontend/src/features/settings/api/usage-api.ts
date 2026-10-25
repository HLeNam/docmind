import { apiClient } from "@/lib/api-client";
import type {
  UsageSummaryQuery,
  UsageSummaryResponse,
} from "../schemas/usage-schemas";

export const usageApi = {
  async getSummary(query?: UsageSummaryQuery): Promise<UsageSummaryResponse> {
    const params = new URLSearchParams();
    if (query?.from) params.set("from", query.from);
    if (query?.to) params.set("to", query.to);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return apiClient<UsageSummaryResponse>(`/usage/summary${queryString}`);
  },
};