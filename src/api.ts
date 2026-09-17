import type { HistoryResponse, InboxResponse, ListInboxParams } from './types';

export const API = {
  inbox: '/inbox',
  history: '/history',
  deleteConversation: '/delete-conversation',
} as const;

export async function fetchInbox(params: ListInboxParams = {}): Promise<InboxResponse> {
  const empty: InboxResponse = {
    conversations: [],
    stats: { total: 0, byPlatform: {} },
    platformsConfigured: {},
  };

  try {
    const res = await fetch(API.inbox, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: params.platform,
        q: params.q,
        isDM: params.isDM,
        limit: params.limit ?? 20,
        after: params.after,
      }),
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as InboxResponse;
    if (!data || !Array.isArray(data.conversations)) return empty;
    return {
      conversations: data.conversations,
      nextCursor: data.nextCursor,
      stats: data.stats ?? empty.stats,
      platformsConfigured: data.platformsConfigured ?? {},
    };
  } catch {
    return empty;
  }
}

export async function fetchHistory(conversationId: string): Promise<HistoryResponse> {
  const empty: HistoryResponse = {
    conversation_id: conversationId,
    messages: [],
    conversation: null,
  };
  try {
    const res = await fetch(API.history, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as HistoryResponse;
    return {
      conversation_id: data.conversation_id || conversationId,
      messages: Array.isArray(data.messages) ? data.messages : [],
      conversation: data.conversation ?? null,
    };
  } catch {
    return empty;
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  if (!conversationId) return false;
  try {
    const res = await fetch(API.deleteConversation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
