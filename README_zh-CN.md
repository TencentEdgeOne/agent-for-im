# Agent for IM

跑在 [EdgeOne Makers](https://cloud.tencent.com/document/product/1552/132759) 上的多平台 IM Agent。同一套 OpenAI Agents SDK 运行时，同时回答 Slack、Discord、Telegram、飞书、企业微信、钉钉，以及 Web 聊天页。

**Framework：** OpenAI Agents SDK · **Language：** TypeScript

[English](./README.md) · [GitHub](https://github.com/TencentEdgeOne/agent-for-im)

## 为什么这样设计

Cloud Function 会在 120 秒被杀掉，而一次 Agent 推理经常更长，所以 IM webhook 不能干等到模型返回。

实际路径是：

1. 平台把事件 POST 到 `/slack`、`/discord`、`/telegram`、`/feishu`、`/wecom` 或 `/dingtalk`。
2. Cloud Function 立刻 ack（Slack 的明文 `ok`、飞书 JSON、Discord 的 PONG / DEFERRED）。
3. 平台如果支持改已发消息，就先发一条 `Thinking…` 占位。
4. 把任务交给 `POST /chat` 后断开。这种模式下 `/chat` 会忽略请求上的 abort signal。
5. Agent 跑完后 POST `https://<domain>/chat-callback`。能改消息的平台改占位；不能改的平台再发一条新消息。

`AGENT_CALLBACK_SECRET` 必填。`/chat-callback` 能在 bot 够得着的任何频道发言，Bearer token 是唯一门槛。

## 已接入平台

| 平台 | 路由 | 事件怎么进来 | 回复方式 |
|------|------|--------------|----------|
| Slack | `POST /slack` | Events API Request URL | 在 thread 里改 `Thinking…` 占位 |
| Discord | `POST /discord` | Interactions Endpoint URL（PING / 斜杠命令） | Chat SDK 的 PONG / DEFERRED |
| Discord | `POST /discord-gateway` | Gateway WebSocket（普通 `@mention`） | 和 Slack 一样：占位再改 |
| Telegram | `POST /telegram` | Bot API `setWebhook` | 改占位消息 |
| 飞书 | `POST /feishu` | 事件订阅 Request URL | 新发一条文本（PATCH 只能改卡片） |
| 企业微信 | `GET` / `POST /wecom` | 自建应用回调（仅 1:1） | `message/send` 发 text，不要 markdown |
| 钉钉 | `POST /dingtalk` | 企业内部应用机器人 HTTP 回调 | OpenAPI（`oToMessages` / `groupMessages`），不用 `sessionWebhook` |

Discord 的普通消息不会打到 Interactions URL。需要启动 `POST /discord-gateway`（Agents 运行时，每窗约 9 分钟），或本地跑 `npm run gateway`。同一个 bot token 不要同时开两个 listener。

## 环境变量

把 `.env.example` 复制成 `.env`。只配你要用的平台。

### 始终必填

| 变量 | 说明 |
|------|------|
| `AI_GATEWAY_API_KEY` | 模型网关 API Key（Makers Models 或任意 OpenAI 兼容服务商）。 |
| `AI_GATEWAY_BASE_URL` | 网关 Base URL。Makers Models 用 `https://ai-gateway.edgeone.link/v1`。 |
| `AI_GATEWAY_MODEL` | 可选。默认 `@makers/deepseek-v4-flash`。 |
| `AGENT_CALLBACK_SECRET` | `POST /chat-callback` 的 Bearer token。不配就回不了消息。 |

### Slack

Request URL：`https://<domain>/slack`

| 变量 | 说明 |
|------|------|
| `SLACK_SIGNING_SECRET` | App Credentials → Signing Secret |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token（`xoxb-`）。改 scope 后必须 Reinstall。 |

需要的 scope：`users:read`、`app_mentions:read`、`chat:write`，以及 `channels/groups/im/mpim` 的 `history` 和 `read`。订阅 `app_mention` 和/或 `message.channels`，私聊再加 `message.im`。

### Discord

Interactions URL：`https://<domain>/discord`。打开 **Message Content Intent**。

| 变量 | 说明 |
|------|------|
| `DISCORD_BOT_TOKEN` | Bot token |
| `DISCORD_PUBLIC_KEY` | Application public key（64 位 hex） |
| `DISCORD_APPLICATION_ID` | Application ID |
| `DISCORD_GATEWAY_SECRET` | `POST /discord-gateway` 的 Bearer token（没有则回退 `CRON_SECRET`） |

可选：`DISCORD_MENTION_ROLE_IDS`、`DISCORD_RESPOND_TO_CHANNEL_IDS`、`DISCORD_WEBHOOK_URL`（本地 gateway 转发目标）。

### Telegram

域名变了要重跑一次：

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d url=https://<domain>/telegram \
  -d secret_token=<TELEGRAM_WEBHOOK_SECRET_TOKEN>
```

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | BotFather 发的 token |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | 回显在 `x-telegram-bot-api-secret-token`。不配则 `/telegram` 直接拒绝。 |

群里默认只看得到 `@mention`，除非在 BotFather 关隐私模式（`/setprivacy`）。

### 飞书

事件订阅 Request URL：`https://<domain>/feishu`（https，不要末尾斜杠）。订阅 `im.message.receive_v1`。在「事件与回调 → 加密策略」配 Encrypt Key 和 Verification Token。`url_verification` 会回 `{ challenge }`。

| 变量 | 说明 |
|------|------|
| `FEISHU_APP_ID` | `cli_…` |
| `FEISHU_APP_SECRET` | App Secret |
| `FEISHU_ENCRYPT_KEY` | Encrypt Key |
| `FEISHU_VERIFICATION_TOKEN` | Verification Token |

### 企业微信（自建应用，仅 1:1）

接收消息服务器 URL：`https://<domain>/wecom`。GET 解密 `echostr`。企业可信 IP 必须包含 EdgeOne 出口 IP，否则 `errcode 60020`。

| 变量 | 说明 |
|------|------|
| `WECOM_CORP_ID` | 企业 ID |
| `WECOM_AGENT_ID` | 应用 AgentId |
| `WECOM_APP_SECRET` | 应用 Secret |
| `WECOM_TOKEN` | 回调 Token |
| `WECOM_ENCODING_AES_KEY` | 43 位 EncodingAESKey |

### 钉钉（企业内部应用机器人）

HTTP 回调：`https://<domain>/dingtalk`。回复走 OpenAPI，因为 `sessionWebhook` 大约 30 秒就过期。

| 变量 | 说明 |
|------|------|
| `DINGTALK_APP_KEY` | AppKey |
| `DINGTALK_APP_SECRET` | AppSecret |
| `DINGTALK_ROBOT_CODE` | RobotCode |

## 本地开发

前置：Node.js ≥ 18，已安装 EdgeOne CLI（`npm i -g edgeone`）。

```bash
npm install
cp .env.example .env
npm run dev:agents
```

- Web 聊天页：Vite 默认本地端口。
- Agent 观测：`http://localhost:8080/agent-metrics`。
- Discord Gateway 本地兜底（不要和 `/discord-gateway` 同时跑）：

```bash
npm run gateway
```

## 项目结构

```text
agent-for-im/
├── agents/                          # 有状态的 EdgeOne Makers Agents（timeout 600s）
│   ├── chat/index.ts               # POST /chat —— Web SSE，或 IM 的 callback 模式
│   ├── stop/index.ts               # POST /stop —— 中断 Web 端生成
│   ├── discord-gateway/index.ts    # POST /discord-gateway —— 约 9 分钟的 Gateway 窗口
│   ├── _logger.ts
│   ├── _sse.ts
│   └── _tools.ts                   # 示例工具（天气、穿搭、翻译、统计）
├── cloud-functions/                 # 无状态 Node Functions（maxDuration 120s）
│   ├── slack/ · discord/ · telegram/ · feishu/ · wecom/ · dingtalk/
│   ├── chat-callback/              # POST /chat-callback —— 把答复发回 IM
│   ├── history/ · conversations/ · clear-history/ · delete-conversation/
│   ├── _adapters/                  # 每个平台一个文件 + 注册表
│   ├── _bot.ts                     # 共用的 Chat SDK bot
│   ├── _process.ts                 # webhook ack + Chat SDK 分发
│   └── _callback.ts                # callback 约定和鉴权
├── src/                             # React + Vite Web 聊天
├── scripts/discord-gateway.mjs      # 本地 Discord Gateway
├── package.json
├── edgeone.json
└── .env.example
```

以 `_` 开头的文件是私有模块，不会暴露成公开路由。

## 再加一个 IM 平台

1. 加官方包 `@chat-adapter/<name>`，或社区包例如 `@edgeone/chat-adapter-feishu`。
2. 写 `cloud-functions/_adapters/<name>.ts`，并在 `_adapters/index.ts` 注册。
3. 加 `cloud-functions/<name>/index.ts`，调用 `createVendorWebhook`。
4. 如果这个平台没有 HTTP 事件（例如 Discord Gateway），在 `agents/` 里加一个长连接 listener。

不能改已发消息的平台设 `placeholder: false`。`/chat-callback` 会改成新发一条，而不是 edit。

## 资源

- [EdgeOne Makers Agents](https://cloud.tencent.com/document/product/1552/132759)
- [EdgeOne Makers 快速开始](https://cloud.tencent.com/document/product/1552/132786)
- [Makers Models](https://cloud.tencent.com/document/product/1552/132748)

## License

MIT.
