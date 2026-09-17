import type { ReactNode } from 'react';
import type { ConversationDetail } from '../types';
import { PLATFORM_COLOR } from '../types';
import { useT, type MessageKeys } from '../i18n';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import styles from './Inspector.module.css';

interface Props {
  conversation: ConversationDetail | null;
  messageCount: number;
  userCount: number;
  assistantCount: number;
  pending: boolean;
  onCopyLink: () => void;
  onExportMd: () => void;
  onExportJson: () => void;
  onDelete: () => void;
}

const PLATFORM_I18N: Record<string, MessageKeys> = {
  slack: 'platform.slack',
  discord: 'platform.discord',
  telegram: 'platform.telegram',
  feishu: 'platform.feishu',
  wecom: 'platform.wecom',
  dingtalk: 'platform.dingtalk',
  web: 'platform.web',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span className={styles.value}>{children}</span>
    </div>
  );
}

export default function Inspector({
  conversation,
  messageCount,
  userCount,
  assistantCount,
  pending,
  onCopyLink,
  onExportMd,
  onExportJson,
  onDelete,
}: Props) {
  const { t, lang } = useT();

  if (!conversation) {
    return (
      <aside className={styles.pane}>
        <div className={styles.head}>
          <h3>{t('inspector.title')}</h3>
          <span className={styles.idle}>{t('inspector.inactive')}</span>
        </div>
        <div className={styles.body}>
          <p className={styles.banner}>{t('inspector.empty')}</p>
          <div className={styles.card}>
            <Row label={t('inspector.platform')}>-</Row>
            <Row label={t('inspector.channelId')}>-</Row>
            <Row label={t('inspector.threadId')}>-</Row>
            <Row label={t('inspector.type')}>-</Row>
            <Row label={t('inspector.userId')}>-</Row>
            <Row label={t('inspector.count')}>0 {t('inspector.countDetail')}</Row>
            <Row label={t('inspector.status')}>-</Row>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled>{t('inspector.exportDisabled')}</button>
          <button type="button" disabled>{t('inspector.deleteDisabled')}</button>
        </div>
      </aside>
    );
  }

  const color = PLATFORM_COLOR[conversation.platform] || PLATFORM_COLOR.im;
  const platformLabel = PLATFORM_I18N[conversation.platform]
    ? t(PLATFORM_I18N[conversation.platform])
    : conversation.platform;

  const copyId = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside className={styles.pane}>
      <div className={styles.head}>
        <h3>{t('inspector.title')}</h3>
        <span className={pending ? styles.wait : styles.ok}>
          <i />{pending ? t('inspector.pending') : t('inspector.replied')}
        </span>
      </div>
      <div className={styles.body}>
        <section>
          <div className={styles.sectionLabel}>{t('inspector.channel')}</div>
          <div className={styles.card}>
            <Row label={t('inspector.platform')}>
              <span className={styles.pip} style={{ background: color }} />
              {platformLabel}
            </Row>
            <Row label={t('inspector.channelId')}>
              <button type="button" className={styles.idBtn} onClick={() => copyId(conversation.channelId)}>
                {conversation.channelId || '-'}
              </button>
            </Row>
            <Row label={t('inspector.threadId')}>{conversation.threadId || '-'}</Row>
            <Row label={t('inspector.type')}>
              {conversation.isDM ? t('inspector.typeDm') : t('inspector.typeChannel')}
            </Row>
          </div>
        </section>

        <section>
          <div className={styles.sectionLabel}>{t('inspector.people')}</div>
          <div className={styles.card}>
            <Row label={t('inspector.userId')}>{conversation.vendorUserId || '-'}</Row>
            <Row label={t('inspector.userName')}>{conversation.vendorUserName || '-'}</Row>
            <Row label={t('inspector.agent')}>{conversation.model || '-'}</Row>
          </div>
        </section>

        <section>
          <div className={styles.sectionLabel}>{t('inspector.activity')}</div>
          <div className={styles.card}>
            <Row label={t('inspector.created')}>{formatDateTime(conversation.createdAt, lang, t)}</Row>
            <Row label={t('inspector.last')}>
              {formatRelativeTime(conversation.lastMessageAt, lang, t)}
              {conversation.lastMessageAt ? ` (${formatDateTime(conversation.lastMessageAt, lang, t)})` : ''}
            </Row>
            <Row label={t('inspector.count')}>
              {messageCount} {t('inspector.countDetail')} ({t('inspector.user')} {userCount} · {t('inspector.agentShort')} {assistantCount})
            </Row>
            <Row label={t('inspector.status')}>
              {pending ? t('inspector.pending') : t('inspector.replied')}
            </Row>
          </div>
        </section>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={onCopyLink}>{t('inspector.copyLink')}</button>
        <div className={styles.two}>
          <button type="button" onClick={onExportMd}>{t('inspector.exportMd')}</button>
          <button type="button" onClick={onExportJson}>{t('inspector.exportJson')}</button>
        </div>
        <button type="button" className={styles.danger} onClick={onDelete}>{t('inspector.delete')}</button>
      </div>
    </aside>
  );
}
