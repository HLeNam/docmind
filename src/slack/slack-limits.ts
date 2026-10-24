// Hạn mức Slack dùng chung cho /ask VÀ @DocMind: cả hai đều tốn 1 lần embedding + 1 lần LLM (quota Gemini),
// nên dùng CHUNG một bộ đếm theo workspace (cùng khoá) — người dùng không lách được bằng cách luân phiên 2 cách hỏi.
export const SLACK_TEAM_LIMIT_PER_MINUTE = 15;
export const SLACK_TEAM_LIMIT_WINDOW_MS = 60_000;

export const slackTeamLimitKey = (teamId: string): string =>
  `slack:team:${teamId}`;

// Khử trùng event Slack: Slack có thể gửi lại cùng event_id; nhớ 10 phút là dư.
export const SLACK_EVENT_DEDUPE_TTL_MS = 10 * 60_000;
export const slackEventKey = (eventId: string): string =>
  `slack:event:${eventId}`;
