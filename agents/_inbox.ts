/**
 * Inbox archive writes — private module, not a route.
 *
 * IM turns are indexed under a shared userId so POST /inbox can list every
 * platform from one namespace. Metadata carries channel identity the OpenAI
 * session adapter does not store.
 */

export const INBOX_USER_ID = 'im-inbox';

export type InboxSource = {
  platform: string;
  channelId?: string;
  threadId?: string;
  isDM?: boolean;
  vendorUserId?: string;
  vendorUserName?: string;
  channelName?: string;
  sourceEvent?: string;
};

type MemoryStore = {
  appendMessage: (args: Record<string, unknown>) => Promise<unknown>;
  updateConversation?: (args: Record<string, unknown>) => Promise<unknown>;
  getConversation?: (args: Record<string, unknown>) => Promise<unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function snippet(text: string, max = 80): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}...`;
}

export function parseSource(value: unknown): InboxSource {
  const raw = asRecord(value);
  const platform = pickString(raw.platform) || 'web';
  return {
    platform,
    channelId: pickString(raw.channelId ?? raw.channel_id),
    threadId: pickString(raw.threadId ?? raw.thread_id),
    isDM: raw.isDM === true || raw.is_dm === true,
    vendorUserId: pickString(raw.vendorUserId ?? raw.vendor_user_id),
    vendorUserName: pickString(raw.vendorUserName ?? raw.vendor_user_name),
    channelName: pickString(raw.channelName ?? raw.channel_name),
    sourceEvent: pickString(raw.sourceEvent ?? raw.source_event),
  };
}

function inboxMetadata(source: InboxSource, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    inbox: true,
    platform: source.platform,
    ...(source.channelId ? { channelId: source.channelId } : {}),
    ...(source.threadId ? { threadId: source.threadId } : {}),
    ...(source.isDM ? { isDM: true } : {}),
    ...(source.vendorUserId ? { vendorUserId: source.vendorUserId } : {}),
    ...(source.vendorUserName ? { vendorUserName: source.vendorUserName } : {}),
    ...(source.channelName ? { channelName: source.channelName } : {}),
    ...(source.sourceEvent ? { sourceEvent: source.sourceEvent } : {}),
    ...extra,
  };
}

async function mergeConversationMeta(
  store: MemoryStore,
  conversationId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!store.updateConversation) return;
  const attempts = [
    () => store.updateConversation!({ conversationId, metadata }),
    () => store.updateConversation!({ conversation_id: conversationId, metadata }),
    () => (store.updateConversation as (id: string, patch: { metadata: Record<string, unknown> }) => Promise<unknown>)(
      conversationId,
      { metadata },
    ),
  ];
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch {
      /* try the next store signature */
    }
  }
}

async function existingMeta(
  store: MemoryStore,
  conversationId: string,
): Promise<Record<string, unknown>> {
  if (!store.getConversation) return {};
  try {
    const raw = await store.getConversation({ conversationId });
    const rec = asRecord(raw);
    return asRecord(rec.metadata);
  } catch {
    try {
      const raw = await store.getConversation({ conversation_id: conversationId });
      return asRecord(asRecord(raw).metadata);
    } catch {
      return {};
    }
  }
}

export async function recordInboxUser(opts: {
  store: MemoryStore;
  conversationId: string;
  content: string;
  source: InboxSource;
  messageId?: string;
  model?: string;
}): Promise<void> {
  const { store, conversationId, content, source, messageId, model } = opts;
  const metadata = inboxMetadata(source, model ? { model } : undefined);
  await store.appendMessage({
    conversationId,
    role: 'user',
    content,
    userId: INBOX_USER_ID,
    ...(messageId ? { messageId } : {}),
    metadata,
  });

  const prev = await existingMeta(store, conversationId);
  const title = pickString(prev.title) || snippet(content, 40) || 'New chat';
  await mergeConversationMeta(store, conversationId, {
    ...metadata,
    title,
    preview: snippet(content, 80),
    pending: true,
  });
}

export async function recordInboxAssistant(opts: {
  store: MemoryStore;
  conversationId: string;
  content: string;
  source: InboxSource;
  model?: string;
}): Promise<void> {
  const { store, conversationId, content, source, model } = opts;
  const metadata = inboxMetadata(source, model ? { model } : undefined);
  await store.appendMessage({
    conversationId,
    role: 'assistant',
    content,
    userId: INBOX_USER_ID,
    metadata,
  });

  const prev = await existingMeta(store, conversationId);
  await mergeConversationMeta(store, conversationId, {
    ...metadata,
    ...(pickString(prev.title) ? { title: prev.title } : {}),
    preview: snippet(content, 80),
    pending: false,
  });
}
