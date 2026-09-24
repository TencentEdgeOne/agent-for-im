import type { Lang } from '../i18n';

export type PlatformId = 'slack' | 'feishu' | 'dingtalk' | 'discord' | 'telegram' | 'wecom';
export type SetupStep = 1 | 2 | 3 | 4;

export type FieldDef = {
  key: string;
  label: string;
  hint: string;
  optional?: boolean;
};

export type GuideStep = {
  title: string;
  body: string;
};

export type PlatformGuide = {
  id: PlatformId;
  label: string;
  badge: string;
  path: string;
  docs: string;
  fields: FieldDef[];
  paste: string;
  challenge: string;
  steps: GuideStep[];
};

const TEMP_HOST = [
  'localhost',
  '127.0.0.1',
  '.vercel.app',
  '.edgeone.dev',
  '.edgeone.app',
  '.pages.dev',
  '.workers.dev',
  '.ngrok.io',
  '.ngrok-free.app',
  '.trycloudflare.com',
];

export function isTemporaryHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return TEMP_HOST.some((item) => host === item || host.endsWith(item));
}

const OFFICIAL_HOSTS = ['agent-for-im.edgeone.cool', 'agent-for-im.edgeone.dev'];

export function isOfficialTemplate(hostname: string): boolean {
  return OFFICIAL_HOSTS.includes(hostname.toLowerCase());
}

const copy = {
  zh: {
    slack: {
      label: 'Slack',
      paste: '粘贴到 Slack App 后台 Event Subscriptions 的 Request URL。',
      challenge: '提交 Request URL 后，Slack 会发送带 challenge 的校验请求。网关会自动应答，填入后即可通过。',
      steps: [
        { title: '进入官方控制台', body: '打开 [Slack API Console](https://api.slack.com/apps)，选中应用，进入 Features > [Event Subscriptions](https://api.slack.com/apis/connections/events-api)。' },
        { title: '粘贴端点并触发验证', body: '开启 Enable Events，把 Webhook URL 填进 Request URL，等待 Verified。' },
        { title: '勾选核心会话事件', body: '在 Subscribe to bot events 中加入 [app_mention](https://api.slack.com/events/app_mention)、[message.channels](https://api.slack.com/events/message.channels)、[message.im](https://api.slack.com/events/message.im)。' },
      ],
    },
    feishu: {
      label: '飞书',
      paste: '粘贴到飞书开放平台「事件与回调」的请求地址，地址不要带结尾斜杠。',
      challenge: '保存请求地址时，飞书会发送 url_verification。网关会回传 challenge。',
      steps: [
        { title: '进入事件与回调', body: '打开 [飞书开放平台](https://open.feishu.cn/app) 应用，进入「[事件与回调](https://open.feishu.cn/document/server-docs/event-subscription-guide/overview)」。' },
        { title: '填写请求地址', body: '把 Webhook URL 填入请求地址，并配置 [Encrypt Key](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/encrypt-key-encryption-configuration-case) 与 Verification Token。' },
        { title: '订阅消息事件', body: '订阅 [im.message.receive_v1](https://open.feishu.cn/document/server-docs/im-v1/message/events/receive)。群里需要 @机器人 才会收到消息。' },
      ],
    },
    dingtalk: {
      label: '钉钉',
      paste: '粘贴到钉钉企业内部机器人的消息接收地址。',
      challenge: '钉钉回调使用签名校验。App Key、App Secret 与 Robot Code 需要和这里保存的一致。',
      steps: [
        { title: '打开机器人配置', body: '进入 [钉钉开放平台](https://open-dev.dingtalk.com/)，找到企业内部应用的 [机器人](https://open.dingtalk.com/document/orgapp/robot-overview)。' },
        { title: '填写 HTTP 回调', body: '消息接收模式选 [HTTP](https://open.dingtalk.com/document/orgapp/robot-overview)，把 Webhook URL 填入接收地址。' },
        { title: '核对机器人编码', body: '确认 Robot Code 与本页保存的一致，否则回复发不出去。' },
      ],
    },
    discord: {
      label: 'Discord',
      paste: '粘贴到 Discord Developer Portal 的 Interactions Endpoint URL。',
      challenge: '保存端点时 Discord 会发送 PING。网关会回 PONG。频道 @消息还需要单独的 Gateway 监听。',
      steps: [
        { title: '打开应用设置', body: '进入 [Discord Developer Portal](https://discord.com/developers/applications)，打开对应应用。' },
        { title: '填写 Interactions URL', body: '把 Webhook URL 填入 [Interactions Endpoint URL](https://discord.com/developers/docs/interactions/receiving-and-responding#receiving-an-interaction)，并打开 [Message Content Intent](https://discord.com/developers/docs/topics/gateway#message-content-intent)。' },
        { title: '核对公钥', body: 'Public Key 必须与本页保存的一致，否则签名校验会失败。' },
      ],
    },
    telegram: {
      label: 'Telegram',
      paste: '用 Bot API setWebhook 把这个地址注册为 webhook。',
      challenge: '请求头里的 secret token 用来确认更新来自 Telegram。保存 Bot Token 后，可在最后一步导出 .env 再注册。',
      steps: [
        { title: '向 BotFather 取 Token', body: '在 [BotFather](https://t.me/BotFather) 创建机器人，复制形如 123456:ABC 的 token。' },
        { title: '注册 Webhook', body: '调用 [setWebhook](https://core.telegram.org/bots/api#setwebhook)，url 填本页地址。群里默认只收到 @消息。' },
        { title: '确认隐私模式', body: '如果要接收群里的全部消息，在 BotFather 用 [/setprivacy](https://core.telegram.org/bots/features#privacy-mode) 关闭隐私模式。' },
      ],
    },
    wecom: {
      label: '企业微信',
      paste: '粘贴到企业微信自建应用的接收消息服务器 URL。',
      challenge: '保存时企业微信会用 GET 发送 echostr。Token 与 EncodingAESKey 需要和这里一致。',
      steps: [
        { title: '打开自建应用', body: '进入 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)，打开要接入的自建应用。' },
        { title: '设置接收消息', body: '把本页地址填入[接收消息服务器 URL](https://developer.work.weixin.qq.com/document/path/90930)，并填入 Token 与 EncodingAESKey。' },
        { title: '放行出口 IP', body: '回复走固定出口。若返回 [60020](https://developer.work.weixin.qq.com/document/path/90664)，把该出口 IP 加到企业可信 IP。' },
      ],
    },
  },
  en: {
    slack: {
      label: 'Slack',
      paste: 'Paste this into Event Subscriptions → Request URL in the Slack app settings.',
      challenge: 'Slack sends a challenge request when you save the Request URL. The gateway answers it automatically.',
      steps: [
        { title: 'Open the API console', body: 'Open the [Slack API Console](https://api.slack.com/apps) and go to Features > [Event Subscriptions](https://api.slack.com/apis/connections/events-api).' },
        { title: 'Paste the endpoint', body: 'Turn on Enable Events, paste the Webhook URL, and wait for Verified.' },
        { title: 'Subscribe to events', body: 'Add [app_mention](https://api.slack.com/events/app_mention), [message.channels](https://api.slack.com/events/message.channels), and [message.im](https://api.slack.com/events/message.im) under Subscribe to bot events.' },
      ],
    },
    feishu: {
      label: 'Feishu',
      paste: 'Paste this into the Feishu event request URL. Do not add a trailing slash.',
      challenge: 'Feishu sends url_verification when you save the URL. The gateway returns the challenge.',
      steps: [
        { title: 'Open events', body: 'In the [Feishu open platform](https://open.feishu.cn/app), open [Event subscriptions](https://open.feishu.cn/document/server-docs/event-subscription-guide/overview) for the app.' },
        { title: 'Set the request URL', body: 'Paste the Webhook URL and fill [Encrypt Key](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/encrypt-key-encryption-configuration-case) plus Verification Token.' },
        { title: 'Subscribe', body: 'Subscribe to [im.message.receive_v1](https://open.feishu.cn/document/server-docs/im-v1/message/events/receive). Group messages arrive only on @mentions.' },
      ],
    },
    dingtalk: {
      label: 'DingTalk',
      paste: 'Paste this into the DingTalk internal robot HTTP callback.',
      challenge: 'DingTalk signs callbacks. App Key, App Secret, and Robot Code must match what you save here.',
      steps: [
        { title: 'Open the robot', body: 'In the [DingTalk open platform](https://open-dev.dingtalk.com/), open the internal-app [robot](https://open.dingtalk.com/document/orgapp/robot-overview).' },
        { title: 'Set the HTTP callback', body: 'Choose [HTTP](https://open.dingtalk.com/document/orgapp/robot-overview) and paste the Webhook URL as the receive address.' },
        { title: 'Check the robot code', body: 'Robot Code must match the value saved here or replies will fail.' },
      ],
    },
    discord: {
      label: 'Discord',
      paste: 'Paste this into the Discord Interactions Endpoint URL.',
      challenge: 'Discord sends a PING when you save the endpoint. The gateway replies with PONG. Channel @mentions also need the Gateway listener.',
      steps: [
        { title: 'Open the application', body: 'Open the app in the [Discord Developer Portal](https://discord.com/developers/applications).' },
        { title: 'Set the interactions URL', body: 'Paste the Webhook URL into the [Interactions Endpoint URL](https://discord.com/developers/docs/interactions/receiving-and-responding#receiving-an-interaction) and enable the [Message Content Intent](https://discord.com/developers/docs/topics/gateway#message-content-intent).' },
        { title: 'Check the public key', body: 'The public key must match the value saved here or signature checks fail.' },
      ],
    },
    telegram: {
      label: 'Telegram',
      paste: 'Register this URL with the Bot API setWebhook method.',
      challenge: 'The secret token proves an update came from Telegram. Export .env on the last step, then register the webhook.',
      steps: [
        { title: 'Copy the bot token', body: 'Create the bot in [BotFather](https://t.me/BotFather) and copy the token.' },
        { title: 'Call setWebhook', body: 'Call [setWebhook](https://core.telegram.org/bots/api#setwebhook) with url set to this page’s address. Groups only deliver @mentions by default.' },
        { title: 'Privacy mode', body: 'Disable privacy mode with [/setprivacy](https://core.telegram.org/bots/features#privacy-mode) if the bot should see every group message.' },
      ],
    },
    wecom: {
      label: 'WeCom',
      paste: 'Paste this into the WeCom self-built app callback URL.',
      challenge: 'WeCom verifies the URL with a GET echostr. Token and EncodingAESKey must match the values saved here.',
      steps: [
        { title: 'Open the app', body: 'In the [WeCom admin console](https://work.weixin.qq.com/wework_admin/frame), open the self-built app.' },
        { title: 'Set the callback', body: 'Paste the Webhook URL into the [callback URL](https://developer.work.weixin.qq.com/document/path/90930) and enter Token plus EncodingAESKey.' },
        { title: 'Allow the egress IP', body: 'Replies use a fixed egress IP. Add it under trusted IPs if you see errcode [60020](https://developer.work.weixin.qq.com/document/path/90664).' },
      ],
    },
  },
} as const;

export const SHARED_FIELDS: FieldDef[] = [
  { key: 'AGENT_CALLBACK_SECRET', label: 'Callback secret', hint: 'AGENT_CALLBACK_SECRET' },
];

const SHARED: Record<PlatformId, { badge: string; path: string; docs: string; fields: FieldDef[] }> = {
  slack: {
    badge: 'Slack App',
    path: '/slack',
    docs: 'https://api.slack.com/apps',
    fields: [
      { key: 'SLACK_SIGNING_SECRET', label: 'Signing Secret', hint: 'SLACK_SIGNING_SECRET' },
      { key: 'SLACK_BOT_TOKEN', label: 'Bot User OAuth Token', hint: 'SLACK_BOT_TOKEN' },
    ],
  },
  feishu: {
    badge: 'Feishu',
    path: '/feishu',
    docs: 'https://open.feishu.cn/app',
    fields: [
      { key: 'FEISHU_APP_ID', label: 'App ID', hint: 'FEISHU_APP_ID' },
      { key: 'FEISHU_APP_SECRET', label: 'App Secret', hint: 'FEISHU_APP_SECRET' },
      { key: 'FEISHU_ENCRYPT_KEY', label: 'Encrypt Key', hint: 'FEISHU_ENCRYPT_KEY' },
      { key: 'FEISHU_VERIFICATION_TOKEN', label: 'Verification Token', hint: 'FEISHU_VERIFICATION_TOKEN' },
    ],
  },
  dingtalk: {
    badge: 'DingTalk',
    path: '/dingtalk',
    docs: 'https://open-dev.dingtalk.com/',
    fields: [
      { key: 'DINGTALK_APP_KEY', label: 'App Key', hint: 'DINGTALK_APP_KEY' },
      { key: 'DINGTALK_APP_SECRET', label: 'App Secret', hint: 'DINGTALK_APP_SECRET' },
      { key: 'DINGTALK_ROBOT_CODE', label: 'Robot Code', hint: 'DINGTALK_ROBOT_CODE' },
    ],
  },
  discord: {
    badge: 'Discord',
    path: '/discord',
    docs: 'https://discord.com/developers/applications',
    fields: [
      { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', hint: 'DISCORD_BOT_TOKEN' },
      { key: 'DISCORD_PUBLIC_KEY', label: 'Public Key', hint: 'DISCORD_PUBLIC_KEY' },
      { key: 'DISCORD_APPLICATION_ID', label: 'Application ID', hint: 'DISCORD_APPLICATION_ID' },
      { key: 'DISCORD_MENTION_ROLE_IDS', label: 'Mention role IDs', hint: 'DISCORD_MENTION_ROLE_IDS', optional: true },
      { key: 'DISCORD_RESPOND_TO_CHANNEL_IDS', label: 'Respond channel IDs', hint: 'DISCORD_RESPOND_TO_CHANNEL_IDS', optional: true },
      { key: 'DISCORD_GATEWAY_SECRET', label: 'Gateway secret', hint: 'DISCORD_GATEWAY_SECRET' },
    ],
  },
  telegram: {
    badge: 'Telegram',
    path: '/telegram',
    docs: 'https://core.telegram.org/bots/api#setwebhook',
    fields: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', hint: 'TELEGRAM_BOT_TOKEN' },
      { key: 'TELEGRAM_WEBHOOK_SECRET_TOKEN', label: 'Webhook secret token', hint: 'TELEGRAM_WEBHOOK_SECRET_TOKEN' },
    ],
  },
  wecom: {
    badge: 'WeCom',
    path: '/wecom',
    docs: 'https://developer.work.weixin.qq.com/document/path/90930',
    fields: [
      { key: 'WECOM_CORP_ID', label: 'Corp ID', hint: 'WECOM_CORP_ID' },
      { key: 'WECOM_AGENT_ID', label: 'Agent ID', hint: 'WECOM_AGENT_ID' },
      { key: 'WECOM_APP_SECRET', label: 'App Secret', hint: 'WECOM_APP_SECRET' },
      { key: 'WECOM_TOKEN', label: 'Callback Token', hint: 'WECOM_TOKEN' },
      { key: 'WECOM_ENCODING_AES_KEY', label: 'EncodingAESKey', hint: 'WECOM_ENCODING_AES_KEY' },
    ],
  },
};

export const PLATFORM_ORDER: PlatformId[] = ['slack', 'feishu', 'dingtalk', 'discord', 'telegram', 'wecom'];

export function platformGuide(id: PlatformId, lang: Lang): PlatformGuide {
  const shared = SHARED[id];
  const text = copy[lang][id];
  return {
    id,
    label: text.label,
    badge: shared.badge,
    path: shared.path,
    docs: shared.docs,
    fields: shared.fields,
    paste: text.paste,
    challenge: text.challenge,
    steps: text.steps.map((step) => ({ title: step.title, body: step.body })),
  };
}

export function webhookUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path}`;
}

export type SetupDraft = {
  entered: boolean;
  step: SetupStep;
  platform: PlatformId;
  testMode: boolean;
  values: Record<string, string>;
  saved: PlatformId[];
};

const STORAGE_KEY = 'im-setup-v1';

const EMPTY: SetupDraft = {
  entered: false,
  step: 1,
  platform: 'slack',
  testMode: false,
  values: {},
  saved: [],
};

export function loadDraft(): SetupDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, values: {}, saved: [] };
    const parsed = JSON.parse(raw) as Partial<SetupDraft>;
    const step = parsed.step;
    return {
      entered: parsed.entered === true,
      step: step === 2 || step === 3 || step === 4 ? step : 1,
      platform: PLATFORM_ORDER.includes(parsed.platform as PlatformId) ? parsed.platform as PlatformId : 'slack',
      testMode: parsed.testMode === true,
      values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
      saved: Array.isArray(parsed.saved)
        ? parsed.saved.filter((id): id is PlatformId => PLATFORM_ORDER.includes(id as PlatformId))
        : [],
    };
  } catch {
    return { ...EMPTY, values: {}, saved: [] };
  }
}

export function saveDraft(draft: SetupDraft): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function platformFields(id: PlatformId): FieldDef[] {
  return [...SHARED_FIELDS, ...SHARED[id].fields];
}

export function platformComplete(id: PlatformId, values: Record<string, string>): boolean {
  return platformFields(id)
    .filter((field) => !field.optional)
    .every((field) => (values[field.key] || '').trim().length > 0);
}

export function toEnvFile(values: Record<string, string>): string {
  const lines = ['# Agent for IM — exported from the setup wizard', ''];
  const shared = SHARED_FIELDS.filter((field) => (values[field.key] || '').trim());
  if (shared.length > 0) {
    for (const field of shared) lines.push(`${field.key}=${values[field.key].trim()}`);
    lines.push('');
  }
  for (const id of PLATFORM_ORDER) {
    const fields = SHARED[id].fields.filter((field) => (values[field.key] || '').trim());
    if (fields.length === 0) continue;
    lines.push(`# ${id}`);
    for (const field of fields) lines.push(`${field.key}=${values[field.key].trim()}`);
    lines.push('');
  }
  return lines.join('\n');
}
