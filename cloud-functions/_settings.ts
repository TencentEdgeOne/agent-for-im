/**
 * IM credentials live in the conversation store, not environment variables.
 * One fixed conversation holds them. Webhooks read it through a short
 * in-process cache so a warm isolate does not hit the store on every event.
 */

import { randomBytes } from 'node:crypto';

export const SETTINGS_ID = 'b7e1c0a2-6d4f-4a91-8c33-1f0a9e2d7b65';

const TTL_MS = 30_000;

export const SETTINGS_KEYS = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'DISCORD_BOT_TOKEN',
  'DISCORD_PUBLIC_KEY',
  'DISCORD_APPLICATION_ID',
  'DISCORD_MENTION_ROLE_IDS',
  'DISCORD_RESPOND_TO_CHANNEL_IDS',
  'DISCORD_GATEWAY_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET_TOKEN',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_ENCRYPT_KEY',
  'FEISHU_VERIFICATION_TOKEN',
  'WECOM_CORP_ID',
  'WECOM_AGENT_ID',
  'WECOM_APP_SECRET',
  'WECOM_TOKEN',
  'WECOM_ENCODING_AES_KEY',
  'DINGTALK_APP_KEY',
  'DINGTALK_APP_SECRET',
  'DINGTALK_ROBOT_CODE',
  'AGENT_CALLBACK_SECRET',
] as const;

const PLATFORM_FIELDS: Record<string, string[]> = {
  slack: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
  discord: ['DISCORD_BOT_TOKEN', 'DISCORD_PUBLIC_KEY', 'DISCORD_APPLICATION_ID', 'DISCORD_GATEWAY_SECRET'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET_TOKEN'],
  feishu: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_ENCRYPT_KEY', 'FEISHU_VERIFICATION_TOKEN'],
  wecom: ['WECOM_CORP_ID', 'WECOM_AGENT_ID', 'WECOM_APP_SECRET', 'WECOM_TOKEN', 'WECOM_ENCODING_AES_KEY'],
  dingtalk: ['DINGTALK_APP_KEY', 'DINGTALK_APP_SECRET', 'DINGTALK_ROBOT_CODE'],
};

export type SettingsStore = {
  getConversation?: (args: Record<string, unknown>) => Promise<unknown>;
  updateConversation?: (args: Record<string, unknown>) => Promise<unknown>;
  appendMessage?: (args: Record<string, unknown>) => Promise<unknown>;
};

type CacheEntry = { secrets: Record<string, string>; expiresAt: number };

let cache: CacheEntry | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^['"]|['"]$/g, '') : '';
}

export function pickSettings(input: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of SETTINGS_KEYS) {
    const value = normalize(input[key]);
    if (value) next[key] = value;
  }
  return next;
}

export type SettingsView = {
  values: Record<string, string>;
  configured: Record<string, boolean>;
};

export function getSettings(secrets: Record<string, string>): SettingsView {
  return {
    values: { ...secrets },
    configured: configuredPlatforms(secrets),
  };
}

export function configuredPlatforms(secrets: Record<string, string>): Record<string, boolean> {
  const configured: Record<string, boolean> = {};
  for (const [name, fields] of Object.entries(PLATFORM_FIELDS)) {
    configured[name] = fields.every((key) => Boolean(secrets[key]));
  }
  return configured;
}

function remember(secrets: Record<string, string>): Record<string, string> {
  cache = { secrets, expiresAt: Date.now() + TTL_MS };
  return secrets;
}

function secretsFromConversation(raw: unknown): Record<string, string> {
  const rec = asRecord(raw);
  const meta = asRecord(rec.metadata);
  const nested = meta.secrets;
  if (typeof nested === 'string') {
    try {
      return pickSettings(asRecord(JSON.parse(nested)));
    } catch {
      return {};
    }
  }
  return pickSettings({ ...meta, ...asRecord(nested) });
}

async function readConversation(store: SettingsStore): Promise<Record<string, string>> {
  if (!store.getConversation) return {};
  try {
    return secretsFromConversation(await store.getConversation({ conversationId: SETTINGS_ID }));
  } catch {
    try {
      return secretsFromConversation(await store.getConversation({ conversation_id: SETTINGS_ID }));
    } catch {
      return {};
    }
  }
}

async function writeConversation(store: SettingsStore, secrets: Record<string, string>): Promise<void> {
  const metadata = { settings: true, inbox: false, secrets: JSON.stringify(secrets) };
  const updates = [
    () => store.updateConversation?.({ conversationId: SETTINGS_ID, metadata }),
    () => store.updateConversation?.({ conversation_id: SETTINGS_ID, metadata }),
  ];
  for (const update of updates) {
    try {
      const result = update();
      if (!result) continue;
      await result;
      return;
    } catch {
      /* conversation may not exist yet */
    }
  }
  if (!store.appendMessage) {
    throw new Error('store cannot persist settings');
  }
  await store.appendMessage({
    conversationId: SETTINGS_ID,
    role: 'user',
    content: 'im-settings',
    userId: 'im-settings',
    metadata,
  });
  for (const update of updates) {
    try {
      const result = update();
      if (!result) continue;
      await result;
      return;
    } catch {
      /* the message write already stored metadata */
    }
  }
}

function ensureGenerated(secrets: Record<string, string>): Record<string, string> {
  const next = { ...secrets };
  if (!next.AGENT_CALLBACK_SECRET) next.AGENT_CALLBACK_SECRET = randomBytes(24).toString('hex');
  if (next.TELEGRAM_BOT_TOKEN && !next.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    next.TELEGRAM_WEBHOOK_SECRET_TOKEN = randomBytes(24).toString('hex');
  }
  if (next.DISCORD_BOT_TOKEN && !next.DISCORD_GATEWAY_SECRET) {
    next.DISCORD_GATEWAY_SECRET = randomBytes(24).toString('hex');
  }
  return next;
}

export async function loadSettings(store: SettingsStore | undefined): Promise<Record<string, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.secrets;
  if (!store) return remember({});
  return remember(await readConversation(store));
}

export async function saveSettings(
  store: SettingsStore,
  patch: Record<string, unknown>,
): Promise<Record<string, string>> {
  const current = await readConversation(store);
  const next = ensureGenerated({ ...current, ...pickSettings(patch) });
  await writeConversation(store, next);
  return remember(next);
}

export function isSettingsConversation(id: string): boolean {
  return id === SETTINGS_ID;
}
