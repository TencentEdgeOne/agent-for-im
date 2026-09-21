import type { ConversationDetail, InboxMessage } from '../types';
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_ROUTE } from '../types';
import { useT, type MessageKeys } from '../i18n';
import { dateKey, formatDateSeparator, shortId } from '../lib/format';
import ChatBubble from './ChatBubble';
import styles from './Transcript.module.css';

interface Props {
  conversation: ConversationDetail | null;
  messages: InboxMessage[];
  loading: boolean;
  platformsConfigured: Record<string, boolean>;
  onCopyLink: () => void;
  onExport: () => void;
}

const PLATFORM_I18N: Record<string, MessageKeys> = {
  slack: 'platform.slack',
  discord: 'platform.discord',
  telegram: 'platform.telegram',
  feishu: 'platform.feishu',
  wecom: 'platform.wecom',
  dingtalk: 'platform.dingtalk',
};

export default function Transcript({
  conversation,
  messages,
  loading,
  platformsConfigured,
  onCopyLink,
  onExport,
}: Props) {
  const { t, lang } = useT();

  if (!conversation) {
    const ready = PLATFORMS.filter((p) => platformsConfigured[p]).length;
    return (
      <section className={styles.stage}>
        <header className={styles.emptyHead}>
          <span className={styles.kicker}>{t('stage.viewLabel')}</span>
          <span className={styles.muted}>{t('stage.notReady')}</span>
          <span className={styles.spacer} />
          <span className={styles.muted}>{t('stage.pendingLoad')}</span>
        </header>
        <div className={styles.emptyBody}>
          <div className={styles.hex}>⬡</div>
          <h1>{t('stage.emptyTitle')}</h1>
          <p>{t('stage.emptyHint')}</p>
          <div className={styles.config}>
            <div className={styles.configHead}>
              <span>{t('stage.configTitle')}</span>
              <span className={styles.readyChip}>{ready} / 6 {t('stage.configReady')}</span>
            </div>
            <div className={styles.configGrid}>
              {PLATFORMS.map((p) => {
                const on = Boolean(platformsConfigured[p]);
                return (
                  <div key={p} className={`${styles.configRow} ${on ? '' : styles.configOff}`}>
                    <span>
                      {t(PLATFORM_I18N[p])} ({PLATFORM_ROUTE[p]})
                    </span>
                    <span className={on ? styles.on : styles.off}>
                      {on ? t('stage.configured') : t('stage.unconfigured')}
                      <i style={{ background: on ? 'var(--accent-gold)' : '#44445a' }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>{t('stage.webhookHint')}</span>
          <span>{t('stage.waitingFirst')}</span>
        </footer>
      </section>
    );
  }

  const color = PLATFORM_COLOR[conversation.platform] || PLATFORM_COLOR.im;
  const heading = conversation.isDM
    ? (conversation.vendorUserName || conversation.vendorUserId || conversation.title)
    : (conversation.channelName || `#${shortId(conversation.channelId) || 'channel'}`);

  let lastDate = '';
  const pending = !loading && (
    conversation.pending || (messages.length > 0 && messages[messages.length - 1].role === 'user')
  );

  return (
    <section className={styles.stage}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <div className={styles.hash} style={{ background: color }}>#</div>
          <div className={styles.headText}>
            <div className={styles.headTitle}>
              <h2>{heading}</h2>
              {conversation.channelId && <span className={styles.chip}>{shortId(conversation.channelId)}</span>}
              <span className={styles.chipGold}>{conversation.isDM ? t('stage.dm') : t('stage.channel')}</span>
            </div>
            <div className={styles.headSub}>
              <span>{t('stage.thread')}: {shortId(conversation.threadId) || '—'}</span>
              <span>•</span>
              <span className={styles.gold}>{loading ? '…' : messages.length} {t('stage.records')}</span>
              <span>•</span>
              <span className={styles.live}><i />{t('stage.unread')}</span>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onCopyLink}>{t('stage.copyLink')}</button>
          <button type="button" onClick={onExport}>{t('stage.export')}</button>
        </div>
      </header>

      <div className={styles.scroll}>
        {loading && messages.length === 0 && (
          <div className={styles.skeletonWrap} aria-hidden>
            <div className={`${styles.skeletonBubble} ${styles.skeletonUser}`}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
            </div>
            <div className={`${styles.skeletonBubble} ${styles.skeletonAssistant}`}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
            </div>
            <div className={`${styles.skeletonBubble} ${styles.skeletonUser}`}>
              <div className={styles.skeletonLine} />
            </div>
            <div className={`${styles.skeletonBubble} ${styles.skeletonAssistant}`}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
            </div>
          </div>
        )}
        {messages.map((msg) => {
          const key = dateKey(msg.timestamp || 0);
          const showSep = key !== lastDate;
          lastDate = key;
          return (
            <div key={msg.id}>
              {showSep && msg.timestamp ? (
                <div className={styles.sep}>
                  <i />
                  <span>{formatDateSeparator(msg.timestamp, lang, t)}</span>
                  <i />
                </div>
              ) : null}
              <ChatBubble message={msg} model={conversation.model} />
            </div>
          );
        })}
        {pending && (
          <div className={styles.waiting}>{t('stage.waitingReply')}</div>
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.live}><i />{t('stage.footerSynced')}</span>
        <span>{t('stage.footerMode')}</span>
        <span>{t('stage.footerEsc')}</span>
      </footer>
    </section>
  );
}

export function CopyToast({ visible, text }: { visible: boolean; text: string }) {
  if (!visible) return null;
  return <div className={styles.toast}>{text}</div>;
}
