/**
 * Agent callback sink — EdgeOne Makers Node Function
 * ==================================================
 *
 * File path cloud-functions/chat-callback/index.ts maps to **POST /chat-callback**.
 *
 * An IM webhook hands the run to /chat without waiting. The agent POSTs the
 * finished answer here. Platforms that posted a "Thinking…" placeholder send
 * that message in `target.message` and this route edits it; the rest get a
 * new `thread.post`. DingTalk prefers `target.replyUrl` (sessionWebhook).
 * See _callback.ts for the contract.
 */

import type { CloudFunctionContext } from '@edgeone/types';
import { Message, ThreadImpl } from 'chat';
import { vendorAdapter } from '../_adapters';
import { getChatBot } from '../_bot';
import { callbackSecret, isCallbackAuthorized, type CallbackRequest } from '../_callback';
import { createLogger } from '../_logger';
import { loadSettings, type SettingsStore } from '../_settings';

const logger = createLogger('chat-callback');
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=UTF-8' } as const;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function redactCallbackError(detail: string): string {
  return detail
    .replace(/access_token=[^&\s"'\\]+/gi, 'access_token=***')
    .replace(/corpsecret=[^&\s"'\\]+/gi, 'corpsecret=***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer ***')
    .replace(/https?:\/\/[^\s"'\\]+/gi, '[url]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/request[_-]?id["']?\s*[:=]\s*["']?[A-Za-z0-9-]+/gi, 'request_id=***')
    .slice(0, 300);
}

function sanitizeCallbackError(detail: string): string {
  if (/435|URL_NOT_FOUND|FunctionNotFound/i.test(detail)) {
    return 'delivery failed: wecom proxy not found';
  }
  if (/errcode=60020|not allow to access from your ip/i.test(detail)) {
    return 'delivery failed: wecom ip not allowlisted';
  }
  if (/access_token missing|echoed the Function URL|event envelope/i.test(detail)) {
    return 'delivery failed: wecom proxy misconfigured';
  }
  if (/HTTP 443|0 code exit unexpected|UserCodeError/i.test(detail)) {
    return 'delivery failed: wecom proxy crashed';
  }
  return 'delivery failed';
}

export async function onRequestPost(context: CloudFunctionContext): Promise<Response> {
  const startTime = Date.now();
  logger.log(`[chat-callback] start: ${new Date(startTime).toISOString()}`);

  try {
    const env = await loadSettings(context.agent?.store as SettingsStore | undefined);
    const secret = callbackSecret(env);
    if (!secret) {
      logger.error('AGENT_CALLBACK_SECRET is not configured');
      return jsonResponse({ status: 'error', message: 'callback secret is not configured' }, 500);
    }
    if (!isCallbackAuthorized(context.request!.headers.get('authorization'), secret)) {
      logger.error('rejected callback with a bad bearer token');
      return jsonResponse({ status: 'error', message: 'unauthorized' }, 401);
    }

    const { target, text } = (await context.request!.json()) as CallbackRequest;
    logger.log(
      `thread=${target.thread.id} message=${target.message?.id ?? 'none'}` +
        ` replyUrl=${target.replyUrl ? 'yes' : 'no'} len=${text.length}` +
        ` preview="${text.slice(0, 80).replace(/\s+/g, ' ')}"`,
    );

    const platform = target.thread.id.split(':')[0] ?? '';
    const vendor = vendorAdapter(platform);
    if (vendor?.deliver) {
      await vendor.deliver(env, target.thread.id, text);
      logger.log(`[chat-callback] done via deliver: total ${Date.now() - startTime}ms`);
      return jsonResponse({ status: 'ok' });
    }
    if (target.replyUrl && vendor?.postReplyUrl) {
      try {
        await vendor.postReplyUrl(target.replyUrl, text);
        logger.log(`[chat-callback] done via replyUrl: total ${Date.now() - startTime}ms`);
        return jsonResponse({ status: 'ok' });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        logger.error(`replyUrl failed, falling back to adapter post: ${redactCallbackError(detail)}`);
      }
    }

    // Builds the Chat singleton that ThreadImpl.fromJSON resolves its adapter from.
    getChatBot(env);

    const thread = ThreadImpl.fromJSON(target.thread);
    if (target.message) {
      const placeholder = thread.createSentMessageFromMessage(Message.fromJSON(target.message));
      await placeholder.edit({ markdown: text });
    } else {
      await thread.post({ markdown: text });
    }

    logger.log(`[chat-callback] done: total ${Date.now() - startTime}ms`);
    return jsonResponse({ status: 'ok' });
  } catch (e) {
    const detail = e instanceof Error ? e.stack || e.message : String(e);
    logger.error(`unhandled chat-callback error: ${redactCallbackError(detail)}`);
    return jsonResponse({ status: 'error', message: sanitizeCallbackError(detail) }, 500);
  }
}
