# Agent for IM

A multi-platform IM agent on [EdgeOne Makers](https://pages.edgeone.ai/document/agents). One OpenAI Agents SDK runtime answers Slack, Discord, Telegram, Feishu, WeCom, DingTalk, and the web chat UI.

**Framework:** OpenAI Agents SDK · **Language:** TypeScript

[中文文档](./README_zh-CN.md) · [GitHub](https://github.com/TencentEdgeOne/agent-for-im)

## Why this exists

A Cloud Function is killed at 120 seconds. An agent run often lasts longer than that, so the IM webhook cannot wait for the model.

The path is:

1. The platform POSTs to `/slack`, `/discord`, `/telegram`, `/feishu`, `/wecom`, or `/dingtalk`.
2. The Cloud Function acks immediately (Slack-style `ok`, Feishu JSON, Discord PONG / DEFERRED).
3. Where the platform can edit a sent message, the bot posts a `Thinking…` placeholder.
4. It hands the run to `POST /chat` and disconnects. `/chat` ignores the request abort signal in this mode.
5. When the agent finishes, it POSTs `https://<domain>/chat-callback`. That route edits the placeholder, or posts a new message on platforms that cannot edit.

`AGENT_CALLBACK_SECRET` is required. `/chat-callback` can speak in any channel the bot can reach, so the bearer token is the only gate.

## Supported platforms

| Platform | Route | How events arrive | Reply style |
|----------|--------|-------------------|-------------|
| Slack | `POST /slack` | Events API Request URL | Edit the `Thinking…` placeholder in the thread |
| Discord | `POST /discord` | Interactions Endpoint URL (PING / slash) | Chat SDK PONG / DEFERRED |
| Discord | `POST /discord-gateway` | Gateway WebSocket (regular `@mentions`) | Same as Slack — placeholder then edit |
| Telegram | `POST /telegram` | Bot API `setWebhook` | Edit the placeholder |
| Feishu | `POST /feishu` | Event Request URL | New text message (PATCH only updates cards) |
| WeCom | `GET` / `POST /wecom` | 自建应用回调（1:1 only） | `message/send` as text, not markdown |
| DingTalk | `POST /dingtalk` | Internal-app robot HTTP callback | OpenAPI (`oToMessages` / `groupMessages`), not `sessionWebhook` |

Discord regular messages never hit the Interactions URL. Start `POST /discord-gateway` (Agents runtime, ~9 minutes per window) or run `npm run gateway` locally. Do not run two listeners on one bot token.

## Environment variables

Copy `.env.example` to `.env`. Only configure the platforms you use.

### Always required

| Variable | Description |
|----------|-------------|
| `AI_GATEWAY_API_KEY` | Model gateway API key (Makers Models or any OpenAI-compatible provider). |
| `AI_GATEWAY_BASE_URL` | Gateway base URL. Makers Models: `https://ai-gateway.edgeone.link/v1`. |
| `AI_GATEWAY_MODEL` | Optional. Defaults to `@makers/deepseek-v4-flash`. |
| `AGENT_CALLBACK_SECRET` | Bearer token for `POST /chat-callback`. Replies fail without it. |

### Slack

Request URL: `https://<domain>/slack`

| Variable | Description |
|----------|-------------|
| `SLACK_SIGNING_SECRET` | App Credentials → Signing Secret |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-`). Reinstall the app after changing scopes. |

Required scopes: `users:read`, `app_mentions:read`, `chat:write`, plus `channels/groups/im/mpim` `history` and `read`. Subscribe to `app_mention` and/or `message.channels`, and `message.im` for DMs.

### Discord

Interactions URL: `https://<domain>/discord`. Enable **Message Content Intent**.

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot token |
| `DISCORD_PUBLIC_KEY` | Application public key (64-char hex) |
| `DISCORD_APPLICATION_ID` | Application ID |
| `DISCORD_GATEWAY_SECRET` | Bearer token for `POST /discord-gateway` (falls back to `CRON_SECRET`) |

Optional: `DISCORD_MENTION_ROLE_IDS`, `DISCORD_RESPOND_TO_CHANNEL_IDS`, `DISCORD_WEBHOOK_URL` (local gateway target).

### Telegram

Register once (re-run if the domain changes):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d url=https://<domain>/telegram \
  -d secret_token=<TELEGRAM_WEBHOOK_SECRET_TOKEN>
```

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Echoed as `x-telegram-bot-api-secret-token`. `/telegram` refuses to run without it. |

In groups the bot only sees `@mentions` unless you disable privacy mode (`/setprivacy`).

### Feishu

Event Request URL: `https://<domain>/feishu` (https, no trailing slash). Subscribe to `im.message.receive_v1`. Configure Encrypt Key and Verification Token under 事件与回调 → 加密策略. `url_verification` is answered with `{ challenge }`.

| Variable | Description |
|----------|-------------|
| `FEISHU_APP_ID` | `cli_…` |
| `FEISHU_APP_SECRET` | App secret |
| `FEISHU_ENCRYPT_KEY` | Encrypt Key |
| `FEISHU_VERIFICATION_TOKEN` | Verification Token |

### WeCom (self-built app, 1:1)

接收消息服务器 URL: `https://<domain>/wecom`. GET decrypts `echostr`. Add the EdgeOne egress IP under 企业可信IP (`errcode 60020` if missing).

| Variable | Description |
|----------|-------------|
| `WECOM_CORP_ID` | Corp ID |
| `WECOM_AGENT_ID` | Agent ID |
| `WECOM_APP_SECRET` | App secret |
| `WECOM_TOKEN` | Callback token |
| `WECOM_ENCODING_AES_KEY` | 43-char EncodingAESKey |

### DingTalk (internal-app robot)

HTTP callback: `https://<domain>/dingtalk`. Replies use OpenAPI because `sessionWebhook` expires in ~30s.

| Variable | Description |
|----------|-------------|
| `DINGTALK_APP_KEY` | App key |
| `DINGTALK_APP_SECRET` | App secret |
| `DINGTALK_ROBOT_CODE` | Robot code |

## Local development

Prerequisites: Node.js ≥ 18 and the EdgeOne CLI (`npm i -g edgeone`).

```bash
npm install
cp .env.example .env
npm run dev:agents
```

- Web UI: Vite on the usual local port.
- Agent metrics: `http://localhost:8080/agent-metrics`.
- Discord Gateway fallback (do not run this and `/discord-gateway` at the same time):

```bash
npm run gateway
```

## Project structure

```text
agent-for-im/
├── agents/                          # Stateful EdgeOne Makers Agents (timeout 600s)
│   ├── chat/index.ts               # POST /chat — SSE stream, or callback mode for IM
│   ├── stop/index.ts               # POST /stop — abort a web-UI run
│   ├── discord-gateway/index.ts    # POST /discord-gateway — 9-minute Gateway window
│   ├── _logger.ts
│   ├── _sse.ts
│   └── _tools.ts                   # Sample tools (weather, clothing, translate, stats)
├── cloud-functions/                 # Stateless Node Functions (maxDuration 120s)
│   ├── slack/ · discord/ · telegram/ · feishu/ · wecom/ · dingtalk/
│   ├── chat-callback/              # POST /chat-callback — deliver the finished answer
│   ├── history/ · conversations/ · clear-history/ · delete-conversation/
│   ├── _adapters/                  # One file per vendor + registry
│   ├── _bot.ts                     # Shared Chat SDK bot
│   ├── _process.ts                 # Webhook ack + Chat SDK dispatch
│   └── _callback.ts                # Callback contract + auth
├── src/                             # React + Vite web chat
├── scripts/discord-gateway.mjs      # Local Discord Gateway listener
├── package.json
├── edgeone.json
└── .env.example
```

Files prefixed with `_` are private modules — not public routes.

## Adding another IM vendor

1. Add the official `@chat-adapter/<name>` package, or a community adapter such as `@edgeone/chat-adapter-feishu`.
2. Create `cloud-functions/_adapters/<name>.ts` and register it in `_adapters/index.ts`.
3. Add `cloud-functions/<name>/index.ts` with `createVendorWebhook`.
4. If the vendor has no HTTP events (Discord Gateway), add a long-lived listener in `agents/`.

`placeholder: false` on vendors that cannot edit a sent message. `/chat-callback` then posts a new message instead of editing.

## Resources

- [EdgeOne Makers Agents](https://pages.edgeone.ai/document/agents)
- [EdgeOne Makers Quick Start](https://pages.edgeone.ai/document/agents-quick-start)
- [Makers Models](https://pages.edgeone.ai/document/models)

## License

MIT.
