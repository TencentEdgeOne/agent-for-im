/**
 * History handler — EdgeOne Makers Node Function
 * ==============================================
 *
 * File path cloud-functions/history/index.ts maps to **POST /history**.
 *
 * Prefers inbox-tagged turns (channel + user + agent reply). Falls back to
 * OpenAI session records for older conversations, merging fragments and
 * dropping adjacent duplicates.
 */

import type { CloudFunctionContext } from '@edgeone/types';
import {
  asRecord,
  jsonResponse,
  pickString,
  readJsonBody,
  sourceFromMeta,
  type InboxSource,
} from '../_inbox';
import { createLogger } from '../_logger';

const logger = createLogger('history');

interface MemoryMessage {
  messageId?: string;
  role?: string;
  content?: unknown;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

interface FrontendMessage extends InboxSource {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  error?: boolean;
}

interface NormalizedMessage {
  message: FrontendMessage;
  runId?: string;
  inbox?: boolean;
}

function getConversationId(context: CloudFunctionContext, body: Record<string, unknown>): string {
  const fromBody = pickString(body.conversation_id, body.conversationId);
  if (fromBody) return fromBody;
  try {
    const headerValue = context?.request?.headers?.get?.('makers-conversation-id');
    if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();
  } catch {
    /* noop */
  }
  return '';
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (content !== null && typeof content === 'object' && !Array.isArray(content)) {
    const obj = asRecord(content);
    if ('content' in obj) return contentToText(obj.content);
    if ('output' in obj) return contentToText(obj.output);
    if ('text' in obj) return String(obj.text ?? '');
    return '';
  }

  if (Array.isArray(content)) {
    return content
      .filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object',
      )
      .map(item => String(item.text ?? item.output_text ?? ''))
      .filter(Boolean)
      .join('\n');
  }

  return String(content ?? '');
}

function normalizeMessage(item: MemoryMessage): NormalizedMessage | null {
  const role = item.role;
  if (role !== 'user' && role !== 'assistant') return null;

  const meta = item.metadata ?? {};
  if (meta.agent_sdk_session) {
    const itemType = meta.item_type as string | null | undefined;
    if (itemType != null && itemType !== 'message') return null;
  }

  const content = contentToText(item.content);
  if (!content) return null;

  const source = sourceFromMeta(meta);
  return {
    message: {
      id: item.messageId ?? `${role}-${item.createdAt ?? 0}`,
      role,
      content,
      timestamp: item.createdAt ?? 0,
      error: meta.error === true,
      ...source,
    },
    runId: meta.run_id as string | undefined,
    inbox: meta.inbox === true,
  };
}

function mergeAssistantFragments(items: NormalizedMessage[]): FrontendMessage[] {
  const sorted = [...items].sort((a, b) => a.message.timestamp - b.message.timestamp);
  const merged: FrontendMessage[] = [];
  let lastRunId: string | undefined;

  for (const { message, runId } of sorted) {
    const previous = merged[merged.length - 1];
    const sameRunAssistant = Boolean(
      previous &&
        runId &&
        runId === lastRunId &&
        previous.role === 'assistant' &&
        message.role === 'assistant',
    );

    if (sameRunAssistant) {
      previous.content += `\n\n${message.content}`;
    } else {
      merged.push({ ...message });
      lastRunId = runId;
    }
  }

  return merged;
}

function dedupeAdjacent(messages: FrontendMessage[]): FrontendMessage[] {
  const deduped: FrontendMessage[] = [];
  for (const message of messages) {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      previous.role === message.role &&
      previous.content === message.content
    ) {
      continue;
    }
    deduped.push(message);
  }
  return deduped;
}

async function loadAllMessages(
  store: { getMessages: (args: Record<string, unknown>) => Promise<MemoryMessage[]> },
  conversationId: string,
): Promise<MemoryMessage[]> {
  const all: MemoryMessage[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const history = await store.getMessages({
      conversationId,
      limit: 100,
      order: 'asc',
      ...(after ? { after } : {}),
    });
    if (!Array.isArray(history) || history.length === 0) break;
    all.push(...history);
    if (history.length < 100) break;
    after = history[history.length - 1]?.messageId;
    if (!after) break;
  }
  return all;
}

function conversationSummary(
  raw: unknown,
  messages: FrontendMessage[],
): Record<string, unknown> {
  const rec = asRecord(raw);
  const meta = sourceFromMeta(asRecord(rec.metadata));
  const userCount = messages.filter(m => m.role === 'user').length;
  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  const last = messages[messages.length - 1];
  const pending = Boolean(last && last.role === 'user');
  return {
    id: pickString(rec.conversationId, rec.conversation_id, rec.id),
    createdAt: rec.createdAt,
    lastMessageAt: rec.lastMessageAt,
    messageCount: messages.length || rec.messageCount,
    userCount,
    assistantCount,
    pending,
    model: meta.model || messages.find(m => m.model)?.model,
    ...meta,
  };
}

export async function onRequestPost(context: CloudFunctionContext): Promise<Response> {
  const requestStartTime = Date.now();
  logger.log(`[history] start: ${new Date(requestStartTime).toISOString()}`);

  const body = await readJsonBody(context.request);
  const conversationId = getConversationId(context, body);
  const { store } = context.agent!;

  logger.log('conversationId:', conversationId || '-');

  if (!conversationId) {
    return jsonResponse({ conversation_id: conversationId, messages: [], conversation: null });
  }

  try {
    const history = await loadAllMessages(store, conversationId);
    const visible = history
      .map(normalizeMessage)
      .filter((item): item is NormalizedMessage => item !== null);
    const inboxOnly = visible.filter(item => item.inbox);
    const source = inboxOnly.length > 0 ? inboxOnly : visible;
    const messages = dedupeAdjacent(mergeAssistantFragments(source));

    let conversation: Record<string, unknown> | null = null;
    try {
      const raw = await store.getConversation({ conversationId } as any);
      conversation = conversationSummary(raw, messages);
    } catch {
      conversation = conversationSummary({ conversationId }, messages);
    }

    logger.log(
      `[history] end: ${new Date().toISOString()}, total: ${Date.now() - requestStartTime}ms ` +
        `(${history.length} raw -> ${messages.length} bubbles)`,
    );

    return jsonResponse({ conversation_id: conversationId, messages, conversation });
  } catch (e) {
    logger.error('failed to get messages:', e);
    return jsonResponse({ conversation_id: conversationId, messages: [], conversation: null });
  }
}
