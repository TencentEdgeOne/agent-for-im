import type { HistoryResponse, InboxResponse, ListInboxParams } from './types';

export const API = {
  inbox: '/inbox',
  history: '/history',
  deleteConversation: '/delete-conversation',
  settings: '/settings',
} as const;

function isArchivedErrorMessage(content: string, error?: boolean): boolean {
  return error === true || /^\s*Agent error:/i.test(content);
}

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
      conversations: data.conversations.map((c) => (
        c.preview && isArchivedErrorMessage(c.preview)
          ? { ...c, preview: undefined }
          : c
      )),
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
      messages: Array.isArray(data.messages)
        ? data.messages.filter((m) => !isArchivedErrorMessage(m.content || '', m.error))
        : [],
      conversation: data.conversation ?? null,
    };
  } catch {
    return empty;
  }
}

export type ImSettings = {
  values: Record<string, string>;
  configured: Record<string, boolean>;
};

const EMPTY_SETTINGS: ImSettings = { values: {}, configured: {} };

function readSettingsPayload(data: unknown): ImSettings | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { values?: unknown; configured?: unknown };
  const values: Record<string, string> = {};
  if (rec.values && typeof rec.values === 'object' && !Array.isArray(rec.values)) {
    for (const [key, value] of Object.entries(rec.values)) {
      if (typeof value === 'string' && value.trim()) values[key] = value;
    }
  }
  const configured: Record<string, boolean> = {};
  if (rec.configured && typeof rec.configured === 'object' && !Array.isArray(rec.configured)) {
    for (const [key, value] of Object.entries(rec.configured)) {
      configured[key] = value === true;
    }
  }
  return { values, configured };
}

export type SettingsResult =
  | { ok: true; settings: ImSettings }
  | { ok: false; message: string };

async function readSettingsResponse(res: Response): Promise<SettingsResult> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return { ok: false, message: 'settings returned a page' };
  }
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: 'settings returned invalid JSON' };
  }
  if (!res.ok) {
    const message = data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
      ? (data as { message: string }).message
      : `HTTP ${res.status}`;
    return { ok: false, message };
  }
  return { ok: true, settings: readSettingsPayload(data) ?? EMPTY_SETTINGS };
}

export async function saveImSettings(values: Record<string, string>): Promise<SettingsResult> {
  try {
    const res = await fetch(API.settings, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    return await readSettingsResponse(res);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network error' };
  }
}

export async function fetchImSettings(): Promise<SettingsResult> {
  try {
    const res = await fetch(API.settings, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get' }),
    });
    return await readSettingsResponse(res);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network error' };
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
