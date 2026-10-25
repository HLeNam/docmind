import { z } from "zod";

export interface SlackIntegrationStatus {
  connected: boolean;
  slackTeamId?: string;
  connectedAt?: string;
}

export interface SlackInstallUrlResponse {
  url: string;
}

export interface SlackChannelMapping {
  channelId: string;
  collectionId: string;
  collectionName: string;
}

export const mapChannelSchema = z.object({
  channelId: z
    .string()
    .trim()
    .min(1, "Mã kênh Slack không được để trống")
    .regex(/^C[A-Z0-9]+$/, "Mã kênh Slack phải bắt đầu bằng chữ 'C' theo chuẩn Slack (ví dụ: C0123ABCDEF)"),
  collectionId: z.string().uuid("Vui lòng chọn bộ sưu tập hợp lệ"),
});

export type MapChannelFormData = z.infer<typeof mapChannelSchema>;