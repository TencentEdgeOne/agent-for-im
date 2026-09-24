/**
 * IM settings — EdgeOne Makers Node Function
 * ==========================================
 *
 * File path cloud-functions/settings/index.ts maps to **POST /settings**.
 *
 * Writes channel credentials into the conversation store. GET returns the
 * stored values so the setup page can fill the form. Webhook routes read
 * the same record.
 */

import type { CloudFunctionContext } from '@edgeone/types';
import { createLogger } from '../_logger';
import {
  getSettings,
  loadSettings,
  saveSettings,
  type SettingsStore,
} from '../_settings';

const logger = createLogger('settings');
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=UTF-8' } as const;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readBody(context: CloudFunctionContext): Promise<Record<string, unknown>> {
  try {
    const data = await context.request!.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const rec = data as Record<string, unknown>;
    if (rec.action === 'get') return { action: 'get' };
    const nested = rec.values;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
    return rec;
  } catch {
    return {};
  }
}

function storeOf(context: CloudFunctionContext): SettingsStore {
  const store = context.agent?.store;
  if (!store) throw new Error('agent store is unavailable');
  return store as unknown as SettingsStore;
}

async function readSettings(context: CloudFunctionContext): Promise<Response> {
  const secrets = await loadSettings(storeOf(context));
  return jsonResponse(getSettings(secrets));
}

export async function onRequestGet(context: CloudFunctionContext): Promise<Response> {
  try {
    return await readSettings(context);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('failed to read settings:', e);
    return jsonResponse({ status: 'error', message, values: {}, configured: {} }, 500);
  }
}

export async function onRequestPost(context: CloudFunctionContext): Promise<Response> {
  const startTime = Date.now();
  logger.log(`[settings] start: ${new Date(startTime).toISOString()}`);
  try {
    const body = await readBody(context);
    if (body.action === 'get') return await readSettings(context);
    const secrets = await saveSettings(storeOf(context), body);
    logger.log(`[settings] end: ${new Date().toISOString()}, total: ${Date.now() - startTime}ms`);
    return jsonResponse({ status: 'ok', ...getSettings(secrets) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('failed to save settings:', e);
    logger.log(`[settings] end: ${new Date().toISOString()}, total: ${Date.now() - startTime}ms`);
    return jsonResponse({ status: 'error', message, values: {}, configured: {} }, 500);
  }
}
