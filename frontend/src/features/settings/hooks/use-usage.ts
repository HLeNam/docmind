import { useQuery } from "@tanstack/react-query";
import { usageApi } from "../api/usage-api";
import type {
  UsageSummaryQuery,
  UsageSummaryResponse,
} from "../schemas/usage-schemas";

export const USAGE_SUMMARY_KEY = ["settings", "usage", "summary"];

export function useUsageSummary(query?: UsageSummaryQuery) {
  return useQuery<UsageSummaryResponse, Error>({
    queryKey: [...USAGE_SUMMARY_KEY, query?.from, query?.to],
    queryFn: () => usageApi.getSummary(query),
  });
}