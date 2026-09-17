export const PLATFORMS = [
  'slack',
  'discord',
  'telegram',
  'feishu',
  'wecom',
  'dingtalk',
] as const;

export type PlatformId = (typeof PLATFORMS)[number];

export const PLATFORM_COLOR: Record<string, string> = {
  slack: '#E01E5A',
  discord: '#5865F2',
  telegram: '#229ED9',
  feishu: '#00D6B9',
  wecom: '#2B7BE4',
  dingtalk: '#0089FF',
  web: '#f5c842',
  im: '#8888aa',
};

export const PLATFORM_ROUTE: Record<string, string> = {
  slack: '/slack',
  discord: '/discord',
  telegram: '/telegram',
  feishu: '/feishu',
  wecom: '/wecom',
  dingtalk: '/dingtalk',
};

export interface InboxConversation {
  id: string;
  title: string;
  preview?: string;
  platform: string;
  channelId?: string;
  threadId?: string;
  isDM?: boolean;
  vendorUserId?: string;
  vendorUserName?: string;
  channelName?: string;
  sourceEvent?: string;
  lastMessageAt?: number;
  createdAt?: number;
  messageCount?: number;
  pending?: boolean;
  model?: string;
}

export interface InboxMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  timestamp: number;
  platform?: string;
  channelId?: string;
  threadId?: string;
  isDM?: boolean;
  vendorUserId?: string;
  vendorUserName?: string;
  channelName?: string;
  model?: string;
  error?: boolean;
}

export interface ConversationDetail extends InboxConversation {
  userCount?: number;
  assistantCount?: number;
}

export interface InboxStats {
  total: number;
  filtered?: number;
  byPlatform: Record<string, number>;
}

export interface InboxResponse {
  conversations: InboxConversation[];
  nextCursor?: string;
  stats: InboxStats;
  platformsConfigured: Record<string, boolean>;
}

export interface HistoryResponse {
  conversation_id: string;
  messages: InboxMessage[];
  conversation: ConversationDetail | null;
}

export interface ListInboxParams {
  platform?: string;
  q?: string;
  isDM?: boolean;
  limit?: number;
  after?: string;
}
