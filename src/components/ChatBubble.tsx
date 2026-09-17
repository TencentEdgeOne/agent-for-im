import { memo, useState } from 'react';
import type { InboxMessage } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useT } from '../i18n';
import { copyText, formatClock } from '../lib/format';
import styles from './ChatBubble.module.css';

interface Props {
  message: InboxMessage;
  model?: string;
}

const TABLE_ROW_BOUNDARY = /\|\s+\|/g;
const TABLE_SEPARATOR_ROW = /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function normalizeCompactTableLine(line: string): string {
  if (!line.includes('| |')) return line;

  const pipeIndexes = [...line.matchAll(/\|/g)]
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);

  for (const index of pipeIndexes) {
    const table = line.slice(index);
    const normalizedTable = table.replace(TABLE_ROW_BOUNDARY, '|\n|');
    const rows = normalizedTable
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length >= 2 && TABLE_SEPARATOR_ROW.test(rows[1])) {
      const prefix = line.slice(0, index).trimEnd();
      return prefix ? `${prefix}\n${normalizedTable}` : normalizedTable;
    }
  }

  return line;
}

function normalizeMarkdown(content: string): string {
  let inCodeFence = false;
  return content
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }
      return inCodeFence ? line : normalizeCompactTableLine(line);
    })
    .join('\n');
}

export default memo(function ChatBubble({ message, model }: Props) {
  const { t, lang } = useT();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(message.content);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const who = isUser
    ? (message.vendorUserName || t('inspector.user'))
    : (message.model || model || 'Agent');

  return (
    <div className={`${styles.block} ${isUser ? styles.user : styles.agent}`}>
      <div className={styles.meta}>
        {!isUser && <span className={styles.botMark}>⬡</span>}
        <span className={isUser ? styles.userName : styles.agentName}>{who}</span>
        {isUser && message.vendorUserId && (
          <span className={styles.id}>{message.vendorUserId}</span>
        )}
        <span className={styles.time}>{formatClock(message.timestamp, lang)}</span>
      </div>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.agentBubble}`}>
        {isUser ? (
          <p className={styles.plain}>{message.content}</p>
        ) : (
          <div className={styles.markdown}>
            <Markdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(message.content)}</Markdown>
          </div>
        )}
        <button className={styles.copy} type="button" onClick={onCopy} title={copied ? t('stage.copied') : undefined}>
          {copied ? t('stage.copied') : '⧉'}
        </button>
      </div>
    </div>
  );
});
