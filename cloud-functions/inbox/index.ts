/**
 * Inbox handler — EdgeOne Makers Node Function
 * ===========================================
 *
 * File path cloud-functions/inbox/index.ts maps to **POST /inbox**.
 *
 * Lists archived IM conversations written under the shared `im-inbox`
 * user index. Supports platform / DM / keyword filters and returns
 * per-platform counts plus which vendor env vars are configured.
 */

import type { CloudFunctionContext } from '@edgeone/types';
import { buildAdapters } from '../_adapters';
import {
  INBOX_USER_ID,
  PLATFORMS,
  asRecord,
  jsonResponse,
  pickCursor,
  pickList,
  pickString,
  readJsonBody,
  sourceFromMeta,
  timestampOf,
  type InboxSource,
} from '../_inbox';
import { createLogger } from '../_logger';

const logger = createLogger('inbox');

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const MAX_INDEX_PAGES = 10;

type InboxConversation = InboxSource & {
  id: string;
  title: string;
  lastMessageAt?: number;
  createdAt?: number;
  messageCount?: number;
};

function clampLimit(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(raw)));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
    }
  }
  return DEFAULT_LIMIT;
}

function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        const rec = asRecord(item);
        return pickString(rec.text, rec.output_text, rec.content);
      })
      .filter(Boolean)
      .join('\n');
  }
  const rec = asRecord(content);
  return pickString(rec.text, rec.output_text, rec.content);
}

function knownPlatform(platform: string | undefined): boolean {
  return Boolean(platform && (PLATFORMS as readonly string[]).includes(platform));
}

function normalizeConversation(raw: unknown): InboxConversation | null {
  const item = asRecord(raw);
  const id = pickString(item.id, item.conversationId, item.conversation_id);
  if (!id) return null;

  const itemMeta = asRecord(item.metadata);
  const meta = sourceFromMeta({
    ...itemMeta,
    platform: item.platform ?? itemMeta.platform,
    channelId: item.channelId ?? item.channel_id ?? itemMeta.channelId,
    threadId: item.threadId ?? item.thread_id ?? itemMeta.threadId,
    isDM: item.isDM ?? item.is_dm ?? itemMeta.isDM,
    vendorUserId: item.vendorUserId ?? itemMeta.vendorUserId,
    vendorUserName: item.vendorUserName ?? itemMeta.vendorUserName,
    channelName: item.channelName ?? itemMeta.channelName,
    sourceEvent: item.sourceEvent ?? itemMeta.sourceEvent,
    title: item.title ?? itemMeta.title,
    preview: item.preview ?? itemMeta.preview,
    inbox: item.inbox ?? itemMeta.inbox,
  });
  const title =
    pickString(item.title, meta.title) ||
    pickString(item.name, item.subject) ||
    'New chat';
  const preview = pickString(item.preview, item.lastMessage, item.last_message, meta.preview) || undefined;

  let messageCount: number | undefined;
  const rawCount = item.messageCount ?? item.message_count;
  if (typeof rawCount === 'number' && Number.isFinite(rawCount)) messageCount = rawCount;

  return {
    id,
    lastMessageAt:
      timestampOf(item.lastMessageAt) ??
      timestampOf(item.last_message_at) ??
      timestampOf(item.updatedAt),
    createdAt: timestampOf(item.createdAt) ?? timestampOf(item.created_at),
    messageCount,
    ...meta,
    title,
    preview,
  };
}

function matchesQuery(conv: InboxConversation, q: string): boolean {
  if (!q) return true;
  const hay = [
    conv.title,
    conv.preview,
    conv.platform,
    conv.channelId,
    conv.threadId,
    conv.vendorUserId,
    conv.vendorUserName,
    conv.channelName,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return hay.includes(q);
}

type InboxStore = {
  listConversations: (args: Record<string, unknown>) => Promise<unknown>;
  getConversation: (args: Record<string, unknown>) => Promise<unknown>;
  getMessages: (args: Record<string, unknown>) => Promise<unknown>;
};

async function pullConversationPages(
  store: InboxStore,
  extra: Record<string, unknown>,
  seen: Set<string>,
  collected: InboxConversation[],
): Promise<void> {
  let after: string | undefined;
  for (let page = 0; page < MAX_INDEX_PAGES; page += 1) {
    const params: Record<string, unknown> = {
      limit: 100,
      order: 'desc',
      ...extra,
    };
    if (after) params.after = after;
    const result = await store.listConversations(params);
    const items = pickList(result);
    for (const raw of items) {
      const conv = normalizeConversation(raw);
      if (!conv || seen.has(conv.id)) continue;
      seen.add(conv.id);
      collected.push(conv);
    }
    after = pickCursor(result, 'nextCursor', 'next_cursor');
    if (!after || items.length === 0) break;
  }
}

async function hydrateFromMessages(store: InboxStore, conv: InboxConversation): Promise<void> {
  const history = await store.getMessages({
    conversationId: conv.id,
    limit: 50,
    order: 'desc',
  });
  const items = Array.isArray(history) ? history : pickList(history);
  for (const item of items) {
    const rec = asRecord(item);
    const meta = asRecord(rec.metadata);
    const platform = pickString(meta.platform, rec.platform);
    if (!knownPlatform(platform) && meta.inbox !== true) continue;
    Object.assign(conv, sourceFromMeta({ ...meta, platform: platform || meta.platform }));
    if (!conv.title || conv.title === 'New chat') {
      const text = messageContentToText(rec.content);
      if (text) conv.title = text.slice(0, 40);
    }
    return;
  }
}

async function listInboxIndex(store: InboxStore): Promise<InboxConversation[]> {
  const collected: InboxConversation[] = [];
  const seen = new Set<string>();

  try {
    await pullConversationPages(store, { userId: INBOX_USER_ID }, seen, collected);
  } catch (e) {
    logger.error('listConversations im-inbox failed:', e);
  }
  // Discord/Slack threads were previously created under per-user UUIDs, so the
  // shared inbox index misses them. Scan the global list and keep IM rows.
  try {
    await pullConversationPages(store, {}, seen, collected);
  } catch (e) {
    logger.error('listConversations global failed:', e);
  }

  const missing = collected.filter((conv) => !knownPlatform(conv.platform));
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    await Promise.all(batch.map(async (conv) => {
      try {
        const raw = await store.getConversation({ conversationId: conv.id });
        const next = normalizeConversation({ ...asRecord(raw), id: conv.id });
        if (next) Object.assign(conv, next);
      } catch {
        /* keep list row */
      }
      if (!knownPlatform(conv.platform)) {
        try {
          await hydrateFromMessages(store, conv);
        } catch {
          /* keep list row */
        }
      }
    }));
  }

  return collected.filter((conv) => knownPlatform(conv.platform) || conv.inbox === true);
}

function configuredPlatforms(env: Record<string, string | undefined>): Record<string, boolean> {
  const adapters = buildAdapters(env as any);
  const configured: Record<string, boolean> = {};
  for (const name of PLATFORMS) {
    configured[name] = Boolean((adapters as Record<string, unknown>)[name]);
  }
  return configured;
}

export async function onRequestPost(context: CloudFunctionContext): Promise<Response> {
  const startTime = Date.now();
  logger.log(`[inbox] start: ${new Date(startTime).toISOString()}`);

  const body = await readJsonBody(context.request);
  const platform = pickString(body.platform).toLowerCase();
  const q = pickString(body.q, body.query).toLowerCase();
  const isDM = body.isDM === true || body.is_dm === true;
  const limit = clampLimit(body.limit);
  const after = pickString(body.after, body.cursor);
  const store = context.agent!.store as unknown as InboxStore;

  try {
    const all = await listInboxIndex(store);
    const filtered = all.filter((conv) => {
      if (platform && platform !== 'all' && conv.platform !== platform) return false;
      if (isDM && !conv.isDM) return false;
      if (q && !matchesQuery(conv, q)) return false;
      return true;
    });

    let start = 0;
    if (after) {
      const idx = filtered.findIndex((conv) => conv.id === after);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = filtered.slice(start, start + limit);
    const last = page[page.length - 1];
    const hasMore = start + page.length < filtered.length;

    const byPlatform: Record<string, number> = {};
    for (const name of PLATFORMS) byPlatform[name] = 0;
    for (const conv of all) {
      const key = conv.platform || 'im';
      byPlatform[key] = (byPlatform[key] ?? 0) + 1;
    }

    logger.log(
      `[inbox] end: ${new Date().toISOString()}, total: ${Date.now() - startTime}ms ` +
        `(index=${all.length}, filtered=${filtered.length}, page=${page.length})`,
    );

    return jsonResponse({
      conversations: page,
      nextCursor: hasMore && last ? last.id : undefined,
      stats: {
        total: all.length,
        filtered: filtered.length,
        byPlatform,
      },
      platformsConfigured: configuredPlatforms(
        (context.env ?? {}) as Record<string, string | undefined>,
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('failed to list inbox:', e);
    logger.log(`[inbox] end: ${new Date().toISOString()}, total: ${Date.now() - startTime}ms`);
    return jsonResponse({
      status: 'error',
      message,
      conversations: [],
      stats: { total: 0, filtered: 0, byPlatform: {} },
      platformsConfigured: {},
    }, 500);
  }
}
