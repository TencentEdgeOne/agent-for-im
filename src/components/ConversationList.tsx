import type { InboxConversation } from '../types';
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_ROUTE } from '../types';
import { useT, type MessageKeys } from '../i18n';
import { formatRelativeTime, shortId } from '../lib/format';
import styles from './ConversationList.module.css';

interface Props {
  conversations: InboxConversation[];
  activeId: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  dmOnly: boolean;
  onToggleDm: () => void;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
}

function platformLabel(platform: string, t: (key: MessageKeys) => string): string {
  const map: Record<string, MessageKeys> = {
    slack: 'platform.slack',
    discord: 'platform.discord',
    telegram: 'platform.telegram',
    feishu: 'platform.feishu',
    wecom: 'platform.wecom',
    dingtalk: 'platform.dingtalk',
    web: 'platform.web',
  };
  return map[platform] ? t(map[platform]) : platform;
}

function labelOf(conv: InboxConversation): string {
  if (conv.isDM) return conv.vendorUserName || conv.vendorUserId || conv.channelName || conv.id;
  return conv.channelName || (conv.channelId ? `#${shortId(conv.channelId)}` : conv.title);
}

export default function ConversationList({
  conversations,
  activeId,
  loading,
  loadingMore,
  hasMore,
  total,
  dmOnly,
  onToggleDm,
  onSelect,
  onLoadMore,
}: Props) {
  const { t, lang } = useT();

  return (
    <aside className={styles.pane}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.title}>{t('list.title')}</span>
          <span className={styles.count}>{loading ? '…' : `${conversations.length}${lang === 'zh' ? t('list.count') : ''}`}</span>
        </div>
        <label className={styles.dmToggle}>
          <span>{t('list.dmOnly')}</span>
          <input type="checkbox" checked={dmOnly} onChange={onToggleDm} />
          <span className={styles.switch} />
        </label>
      </div>

      <div className={styles.feed} aria-busy={loading}>
        {loading && conversations.length === 0 && (
          <div className={styles.skeletonWrap}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>Inbox</div>
            <p className={styles.emptyTitle}>{t('list.emptyTitle')}</p>
            <p className={styles.emptyHint}>{t('list.emptyHint')}</p>
          </div>
        )}

        <div className={loading && conversations.length > 0 ? styles.feedDim : undefined}>
        {conversations.map((conv) => {
          const color = PLATFORM_COLOR[conv.platform] || PLATFORM_COLOR.im;
          const active = conv.id === activeId;
          return (
            <button
              key={conv.id}
              type="button"
              className={`${styles.row} ${active ? styles.rowActive : ''}`}
              onClick={() => onSelect(conv.id)}
            >
              <div className={styles.rowTop}>
                <span className={styles.pip} style={{ background: color }} />
                <span className={styles.rowLabel}>{labelOf(conv)}</span>
                <span className={styles.badge}>{platformLabel(conv.platform, t)}</span>
                {conv.isDM && <span className={styles.badgeMuted}>{t('list.dm')}</span>}
                {conv.pending && <span className={styles.pendingDot} />}
                <span className={styles.when}>{formatRelativeTime(conv.lastMessageAt ?? conv.createdAt, lang, t)}</span>
              </div>
              <p className={styles.rowTitle}>{conv.title}</p>
              {conv.preview && (
                <p className={styles.rowPreview}>
                  <span>Agent:</span> {conv.preview}
                </p>
              )}
              <div className={styles.rowBottom}>
                <span>{conv.messageCount ?? 0} {t('list.messages')}</span>
                <span>#{conv.platform}-{shortId(conv.id)}</span>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      <div className={styles.foot}>
        {loading ? (
          <div className={styles.end}>{t('list.loading')}</div>
        ) : hasMore ? (
          <button type="button" className={styles.more} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? '…' : t('list.loadMore')}
          </button>
        ) : conversations.length > 0 ? (
          <div className={styles.end}>{t('list.end')} ({conversations.length}{total ? ` / ${total}` : ''})</div>
        ) : (
          <div className={styles.endpoints}>
            <span>{t('list.endpoints')}</span>
            <div className={styles.chips}>
              {PLATFORMS.map((p) => (
                <span key={p}>{PLATFORM_ROUTE[p]}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
