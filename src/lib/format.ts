import type { Lang, MessageKeys } from '../i18n';

export function formatRelativeTime(ts: number | undefined, lang: Lang, t: (key: MessageKeys) => string): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return t('status.justNow');
  if (diff < 60 * 60_000) {
    const m = Math.floor(diff / 60_000);
    return lang === 'zh' ? `${m} ${t('status.minutesAgo')}` : `${m}${t('status.minutesAgo')}`;
  }
  const today = new Date();
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return t('status.yesterday');
  }
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatClock(ts: number | undefined, lang: Lang): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(ts: number | undefined, lang: Lang, t: (key: MessageKeys) => string): string {
  if (!ts || !Number.isFinite(ts)) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const today = new Date();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return `${t('status.today')} ${time}`;
  }
  return `${d.toLocaleDateString(locale)} ${time}`;
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDateSeparator(ts: number, lang: Lang, t: (key: MessageKeys) => string): string {
  const d = new Date(ts);
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return `${t('status.today')} ${time} (UTC+8)`;
  }
  return `${d.toLocaleDateString(locale)} ${time}`;
}

export function shortId(value: string | undefined): string {
  if (!value) return '';
  const last = value.split(':').pop() || value;
  return last.length > 12 ? last.slice(-8) : last;
}

export function conversationPermalink(id: string): string {
  return `${window.location.origin}${window.location.pathname}#/c/${id}`;
}

export function parseHashConversationId(): string | null {
  const match = window.location.hash.match(/^#\/c\/([0-9a-zA-Z-]+)/);
  return match?.[1] ?? null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
