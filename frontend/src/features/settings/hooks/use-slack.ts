import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { slackApi } from "../api/slack-api";
import type {
  MapChannelFormData,
  SlackChannelMapping,
  SlackIntegrationStatus,
} from "../schemas/slack-schemas";

export const SLACK_INTEGRATION_KEY = ["settings", "slack", "integration"];
export const SLACK_CHANNELS_KEY = ["settings", "slack", "channels"];

export function useSlackIntegration() {
  return useQuery<SlackIntegrationStatus, Error>({
    queryKey: SLACK_INTEGRATION_KEY,
    queryFn: () => slackApi.getIntegration(),
  });
}

export function useSlackChannels(enabled = true) {
  return useQuery<SlackChannelMapping[], Error>({
    queryKey: SLACK_CHANNELS_KEY,
    queryFn: () => slackApi.listChannels(),
    enabled,
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();

  return useMutation<{ connected: false }, Error, void>({
    mutationFn: () => slackApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SLACK_INTEGRATION_KEY });
      queryClient.invalidateQueries({ queryKey: SLACK_CHANNELS_KEY });
    },
  });
}

export function useUpsertSlackChannel() {
  const queryClient = useQueryClient();

  return useMutation<SlackChannelMapping, Error, MapChannelFormData>({
    mutationFn: (data) => slackApi.upsertChannel(data.channelId, data.collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SLACK_CHANNELS_KEY });
    },
  });
}

export function useRemoveSlackChannel() {
  const queryClient = useQueryClient();

  return useMutation<{ channelId: string; mapped: false }, Error, string>({
    mutationFn: (channelId) => slackApi.removeChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SLACK_CHANNELS_KEY });
    },
  });
}