import { apiClient } from "@/lib/api-client";
import type {
  SlackChannelMapping,
  SlackInstallUrlResponse,
  SlackIntegrationStatus,
} from "../schemas/slack-schemas";

export const slackApi = {
  async getIntegration(): Promise<SlackIntegrationStatus> {
    return apiClient<SlackIntegrationStatus>("/slack/integration");
  },

  async getInstallUrl(): Promise<SlackInstallUrlResponse> {
    return apiClient<SlackInstallUrlResponse>("/slack/install");
  },

  async disconnect(): Promise<{ connected: false }> {
    return apiClient<{ connected: false }>("/slack/integration", {
      method: "DELETE",
    });
  },

  async listChannels(): Promise<SlackChannelMapping[]> {
    return apiClient<SlackChannelMapping[]>("/slack/channels");
  },

  async upsertChannel(
    channelId: string,
    collectionId: string
  ): Promise<SlackChannelMapping> {
    return apiClient<SlackChannelMapping>(`/slack/channels/${channelId}`, {
      method: "PUT",
      body: { collectionId },
    });
  },

  async removeChannel(
    channelId: string
  ): Promise<{ channelId: string; mapped: false }> {
    return apiClient<{ channelId: string; mapped: false }>(
      `/slack/channels/${channelId}`,
      {
        method: "DELETE",
      }
    );
  },
};