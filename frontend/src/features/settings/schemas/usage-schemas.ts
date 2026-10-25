export interface UsageTypeTotals {
  records: number;
  tokens: number;
  costUsd: number;
}

export interface UsageDailyPoint {
  date: string;
  generationTokens: number;
  embeddingTokens: number;
  tokens: number;
  costUsd: number;
}

export interface UsageSummaryResponse {
  from: string;
  to: string;
  totals: {
    records: number;
    tokens: number;
    costUsd: number;
    byType: {
      GENERATION: UsageTypeTotals;
      EMBEDDING: UsageTypeTotals;
    };
  };
  daily: UsageDailyPoint[];
}

export interface UsageSummaryQuery {
  from?: string;
  to?: string;
}