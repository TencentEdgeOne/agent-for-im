/**
 * Inbox archive helpers — private module, not a route.
 *
 * Shared user namespace and metadata shape used by POST /inbox and /history.
 */

export const INBOX_USER_ID = 'im-inbox';

export const PLATFORMS = [
  'slack',
  'discord',
  'telegram',
  'feishu',
  'wecom',
  'dingtalk',
] as const;

export type PlatformId = (typeof PLATFORMS)[number];

export type InboxSource = {
  platform: string;
  channelId?: string;
  threadId?: string;
  isDM?: boolean;
  vendorUserId?: string;
  vendorUserName?: string;
  channelName?: string;
  sourceEvent?: string;
  title?: string;
  preview?: string;
  pending?: boolean;
  model?: string;
  inbox?: boolean;
};

export const JSON_HEADERS = { 'Content-Type': 'application/json; charset=UTF-8' } as const;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export async function readJsonBody(request: { json: () => Promise<unknown> } | undefined): Promise<Record<string, unknown>> {
  try {
    const data = await request!.json();
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function sourceFromMeta(meta: Record<string, unknown>): InboxSource {
  return {
    platform: pickString(meta.platform) || 'im',
    channelId: pickString(meta.channelId, meta.channel_id) || undefined,
    threadId: pickString(meta.threadId, meta.thread_id) || undefined,
    isDM: meta.isDM === true || meta.is_dm === true,
    vendorUserId: pickString(meta.vendorUserId, meta.vendor_user_id) || undefined,
    vendorUserName: pickString(meta.vendorUserName, meta.vendor_user_name) || undefined,
    channelName: pickString(meta.channelName, meta.channel_name) || undefined,
    sourceEvent: pickString(meta.sourceEvent, meta.source_event) || undefined,
    title: pickString(meta.title) || undefined,
    preview: pickString(meta.preview) || undefined,
    pending: meta.pending === true,
    model: pickString(meta.model) || undefined,
    inbox: meta.inbox === true,
  };
}

export function shortId(value: string | undefined): string {
  if (!value) return '';
  const last = value.split(':').pop() || value;
  if (last.length <= 12) return last;
  return last.slice(-8);
}

export function timestampOf(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function pickList(rawResult: unknown): unknown[] {
  if (!rawResult) return [];
  if (Array.isArray(rawResult)) return rawResult;
  const rec = asRecord(rawResult);
  if (Array.isArray(rec.items)) return rec.items;
  if (Array.isArray(rec.conversations)) return rec.conversations;
  if (Array.isArray(rec.data)) return rec.data;
  if (Array.isArray(rec.results)) return rec.results;
  return [];
}

export function pickCursor(rawResult: unknown, ...keys: string[]): string | undefined {
  const rec = asRecord(rawResult);
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}
