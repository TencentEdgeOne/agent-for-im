# Agent for IM

跑在 [EdgeOne Makers](https://cloud.tencent.com/document/product/1552/132759) 上的多平台 IM Agent。基于Agent，同时回答 Slack、Discord、Telegram、飞书、企业微信、钉钉。

**Framework：** Chat SDK · **Language：** TypeScript

## 已接入平台

| 平台 | 路由 | 接入方式 |
|------|------|----------|
| Slack | `POST /slack` | Events API Request URL |
| Discord | `POST /discord` | Interactions Endpoint URL |
| Discord | `POST /discord-gateway` | 频道 `@mention` 的 Gateway 监听 |
| Telegram | `POST /telegram` | Bot API `setWebhook` |
| 飞书 | `POST /feishu` | 事件订阅 Request URL |
| 企业微信 | `GET` / `POST /wecom` | 自建应用回调（仅 1:1） |
| 钉钉 | `POST /dingtalk` | 企业内部应用机器人 HTTP 回调 |

Discord 频道消息需要启动 `POST /discord-gateway`，或本地跑 `npm run gateway`。同一个 bot token 不要同时开两个 listener。

## Web 集成指引与归档

前端是只读的多渠道会话归档，不再提供网页试聊。每次 IM 对话结束后，Agent 会把渠道、用户原文和回复写入 Makers `context.store`。页面通过这些接口查看：

| 路由 | 作用 |
|------|------|
| `POST /inbox` | 列出会话（可按渠道 / 私聊 / 关键词筛选） |
| `POST /history` | 拉取一条会话的完整来回 |
| `POST /delete-conversation` | 删除归档会话 |

只有本版本上线之后的新对话会出现在列表里。更早的 IM 记录没有 inbox 索引。

## 环境变量

把 `.env.example` 复制成 `.env`。只配你要用的平台。

### 始终必填

| 变量 | 说明 |
|------|------|
| `AI_GATEWAY_API_KEY` | 模型网关 API Key（Makers Models 或任意 OpenAI 兼容服务商）。 |
| `AI_GATEWAY_BASE_URL` | 网关 Base URL。Makers Models 用 `https://ai-gateway.edgeone.link/v1`。 |
| `AI_GATEWAY_MODEL` | 可选。默认 `@makers/deepseek-v4-flash`。 |
| `AGENT_CALLBACK_SECRET` | 回写 IM 消息用的共享密钥。 |

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
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Webhook 校验 token。不配则 `/telegram` 直接拒绝。 |

群里默认只看得到 `@mention`，除非在 BotFather 关隐私模式（`/setprivacy`）。

### 飞书

事件订阅 Request URL：`https://<domain>/feishu`（https，不要末尾斜杠）。订阅 `im.message.receive_v1`。在「事件与回调 → 加密策略」配 Encrypt Key 和 Verification Token。

| 变量 | 说明 |
|------|------|
| `FEISHU_APP_ID` | `cli_…` |
| `FEISHU_APP_SECRET` | App Secret |
| `FEISHU_ENCRYPT_KEY` | Encrypt Key |
| `FEISHU_VERIFICATION_TOKEN` | Verification Token |

### 企业微信（自建应用，仅 1:1）

接收消息服务器 URL：`https://<domain>/wecom`。回消息走写死的固定出口 IP 云函数，把该 IP 配进「企业可信 IP」。

| 变量 | 说明 |
|------|------|
| `WECOM_CORP_ID` | 企业 ID |
| `WECOM_AGENT_ID` | 应用 AgentId |
| `WECOM_APP_SECRET` | 应用 Secret |
| `WECOM_TOKEN` | 回调 Token |
| `WECOM_ENCODING_AES_KEY` | 43 位 EncodingAESKey |

### 钉钉（企业内部应用机器人）

HTTP 回调：`https://<domain>/dingtalk`

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

- Web 归档台：Vite 默认本地端口。
- Agent 观测：`http://localhost:8080/agent-metrics`。
- 本地 Discord Gateway（不要和 `/discord-gateway` 同时跑）：

```bash
npm run gateway
```

## 项目结构

```text
agent-for-im/
├── agents/                          # EdgeOne Makers Agents
│   ├── chat/index.ts               # POST /chat
│   ├── stop/index.ts               # POST /stop
│   ├── discord-gateway/index.ts    # POST /discord-gateway
│   └── _tools.ts                   # 示例工具
├── cloud-functions/                 # IM webhook 和会话接口
│   ├── slack/ · discord/ · telegram/ · feishu/ · wecom/ · dingtalk/
│   ├── chat-callback/
│   ├── history/ · inbox/ · delete-conversation/
│   └── _adapters/                  # 每个平台一个文件
├── src/                             # React + Vite 归档台（只读）
├── scripts/discord-gateway.mjs
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

## 资源

- [EdgeOne Makers Agents](https://cloud.tencent.com/document/product/1552/132759)
- [EdgeOne Makers 快速开始](https://cloud.tencent.com/document/product/1552/132786)
- [Makers Models](https://cloud.tencent.com/document/product/1552/132748)

## License

MIT.
