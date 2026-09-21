import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ConversationDetail, InboxConversation, InboxMessage } from './types';
import { PLATFORMS } from './types';
import { deleteConversation, fetchHistory, fetchInbox } from './api';
import { I18nProvider, useT, type MessageKeys } from './i18n';
import {
  conversationPermalink,
  copyText,
  downloadFile,
  parseHashConversationId,
} from './lib/format';
import ConversationList from './components/ConversationList';
import Transcript, { CopyToast } from './components/Transcript';
import Inspector from './components/Inspector';
import GitHubLink from './components/GitHubLink';
import DeployLink from './components/DeployLink';
import styles from './App.module.css';

const PAGE_SIZE = 20;

const PLATFORM_I18N: Record<string, MessageKeys> = {
  all: 'platform.all',
  slack: 'platform.slack',
  discord: 'platform.discord',
  telegram: 'platform.telegram',
  feishu: 'platform.feishu',
  wecom: 'platform.wecom',
  dingtalk: 'platform.dingtalk',
};

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const { t, lang, setLang } = useT();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [dmOnly, setDmOnly] = useState(false);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [stats, setStats] = useState({ total: 0, byPlatform: {} as Record<string, number> });
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialId = parseHashConversationId();
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(
    initialId ? { id: initialId, title: '', platform: 'im' } : null,
  );
  const [historyLoading, setHistoryLoading] = useState(Boolean(initialId));
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const listReqRef = useRef(0);

  const beginListReplace = useCallback(() => {
    listReqRef.current += 1;
    setConversations([]);
    setNextCursor(undefined);
    setListLoading(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      if (next === debouncedQuery) return;
      beginListReplace();
      setDebouncedQuery(next);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, debouncedQuery, beginListReplace]);

  const loadList = useCallback(async (mode: 'replace' | 'append', cursor?: string) => {
    const reqId = mode === 'replace' ? ++listReqRef.current : listReqRef.current;
    if (mode === 'append') setLoadingMore(true);
    else setListLoading(true);
    try {
      const res = await fetchInbox({
        platform: platform === 'all' ? undefined : platform,
        q: debouncedQuery || undefined,
        isDM: dmOnly || undefined,
        limit: PAGE_SIZE,
        after: cursor,
      });
      if (reqId !== listReqRef.current) return;
      setStats(res.stats);
      setConfigured(res.platformsConfigured);
      setNextCursor(res.nextCursor);
      setUpdatedAt(Date.now());
      if (mode === 'append') {
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...res.conversations.filter((c) => !seen.has(c.id))];
        });
      } else {
        setConversations(res.conversations);
      }
    } finally {
      if (reqId === listReqRef.current) {
        setListLoading(false);
        setLoadingMore(false);
      }
    }
  }, [platform, debouncedQuery, dmOnly]);

  const conversationsRef = useRef<InboxConversation[]>([]);
  conversationsRef.current = conversations;
  const threadReqRef = useRef(0);

  const showThreadPlaceholder = useCallback((id: string) => {
    const summary = conversationsRef.current.find((c) => c.id === id);
    setMessages([]);
    setHistoryLoading(true);
    setDetail(summary ? { ...summary, id } : { id, title: '', platform: 'im' });
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const reqId = ++threadReqRef.current;
    setHistoryLoading(true);
    try {
      const res = await fetchHistory(id);
      if (reqId !== threadReqRef.current) return;
      setMessages(res.messages);
      const summary = conversationsRef.current.find((c) => c.id === id);
      setDetail({
        ...(summary || { id, title: '', platform: 'im' }),
        ...res.conversation,
        id,
      });
    } finally {
      if (reqId === threadReqRef.current) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList('replace');
  }, [loadList]);

  useLayoutEffect(() => {
    if (!activeId) {
      threadReqRef.current += 1;
      setMessages([]);
      setDetail(null);
      setHistoryLoading(false);
      return;
    }
    showThreadPlaceholder(activeId);
  }, [activeId, showThreadPlaceholder]);

  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    return () => {
      threadReqRef.current += 1;
    };
  }, [activeId, loadThread]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadList('replace');
      if (activeId) await loadThread(activeId);
    } finally {
      setRefreshing(false);
    }
  }, [activeId, loadList, loadThread]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setActiveId(null);
        window.location.hash = '';
        setMobileView('list');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onHash = () => setActiveId(parseHashConversationId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectConversation = (id: string) => {
    if (id !== activeId) {
      showThreadPlaceholder(id);
      setActiveId(id);
      window.location.hash = `#/c/${id}`;
    }
    setMobileView('thread');
  };

  const handlePlatformChange = (id: string) => {
    if (id === platform) return;
    beginListReplace();
    setPlatform(id);
  };

  const handleToggleDm = () => {
    beginListReplace();
    setDmOnly((v) => !v);
  };

  const flashCopied = async (text: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleCopyLink = () => {
    if (!activeId) return;
    void flashCopied(conversationPermalink(activeId));
  };

  const exportMarkdown = () => {
    if (!activeId) return;
    const lines = [
      `# ${detail?.title || activeId}`,
      '',
      `- platform: ${detail?.platform ?? ''}`,
      `- channel: ${detail?.channelId ?? ''}`,
      `- thread: ${detail?.threadId ?? ''}`,
      '',
      ...messages.map((m) => `**${m.role}** (${new Date(m.timestamp).toISOString()})\n\n${m.content}\n`),
    ];
    downloadFile(`${activeId}.md`, lines.join('\n'), 'text/markdown');
  };

  const exportJson = () => {
    if (!activeId) return;
    downloadFile(
      `${activeId}.json`,
      JSON.stringify({ conversation: detail, messages }, null, 2),
      'application/json',
    );
  };

  const handleDelete = async () => {
    if (!activeId) return;
    if (!window.confirm(t('inspector.deleteConfirm'))) return;
    await deleteConversation(activeId);
    setConversations((prev) => prev.filter((c) => c.id !== activeId));
    setActiveId(null);
    window.location.hash = '';
    setMobileView('list');
    void loadList('replace');
  };

  const updatedLabel = updatedAt
    ? `${t('header.lastRefresh')} ${new Date(updatedAt).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })}`
    : t('header.notLoaded');

  const userCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);
  const assistantCount = useMemo(() => messages.filter((m) => m.role === 'assistant').length, [messages]);
  const pending = Boolean(detail?.pending || (messages.length > 0 && messages[messages.length - 1]?.role === 'user'));

  const chips = [
    { id: 'all', count: stats.total },
    ...PLATFORMS.map((id) => ({ id, count: stats.byPlatform[id] ?? 0 })),
  ];

  return (
    <div className={styles.shell}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.stage}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.logo}>⬡</span>
          <strong>{t('app.title')}</strong>
          <span className={styles.subtitle}>{t('app.subtitle')}</span>
        </div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
          />
          <kbd>{t('search.hotkey')}</kbd>
        </div>
        <div className={styles.topRight}>
          <span className={styles.updated}>{updatedLabel}</span>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void handleRefresh()}
            disabled={refreshing || listLoading}
          >
            <span className={refreshing ? styles.spin : undefined} aria-hidden>↻</span>
            {t('header.refresh')}
          </button>
          <div className={styles.lang}>
            <button type="button" className={lang === 'zh' ? styles.langOn : ''} onClick={() => setLang('zh')}>{t('lang.zh')}</button>
            <button type="button" className={lang === 'en' ? styles.langOn : ''} onClick={() => setLang('en')}>{t('lang.en')}</button>
          </div>
        </div>
      </header>

      <nav className={styles.chips} aria-busy={listLoading}>
        {chips.map((chip) => {
          const selected = platform === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={selected ? styles.chipOn : styles.chip}
              aria-pressed={selected}
              aria-busy={selected && listLoading}
              onClick={() => handlePlatformChange(chip.id)}
            >
              {t(PLATFORM_I18N[chip.id])}
              {selected && listLoading ? (
                <em className={styles.chipBusy} aria-hidden>
                  <i className={styles.chipSpin} />
                </em>
              ) : (
                <em>{chip.count}</em>
              )}
            </button>
          );
        })}
      </nav>

      <div className={`${styles.workspace} ${activeId && mobileView === 'thread' ? styles.threadMode : ''}`}>
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          loading={listLoading}
          loadingMore={loadingMore}
          hasMore={Boolean(nextCursor)}
          total={stats.total}
          dmOnly={dmOnly}
          onToggleDm={handleToggleDm}
          onSelect={selectConversation}
          onLoadMore={() => void loadList('append', nextCursor)}
        />
        <Transcript
          conversation={detail}
          messages={messages}
          loading={historyLoading}
          platformsConfigured={configured}
          onCopyLink={handleCopyLink}
          onExport={exportMarkdown}
        />
        <Inspector
          conversation={detail}
          messageCount={messages.length}
          userCount={detail?.userCount ?? userCount}
          assistantCount={detail?.assistantCount ?? assistantCount}
          pending={pending}
          onCopyLink={handleCopyLink}
          onExportMd={exportMarkdown}
          onExportJson={exportJson}
          onDelete={() => void handleDelete()}
        />
      </div>
      </div>
      <CopyToast visible={copied} text={t('stage.copied')} />
      <GitHubLink />
      <DeployLink />
    </div>
  );
}
