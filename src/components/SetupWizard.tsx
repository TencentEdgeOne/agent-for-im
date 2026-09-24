import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { copyText, downloadFile } from '../lib/format';
import { fetchImSettings, saveImSettings, type ImSettings } from '../api';
import { getDeployUrl } from './DeployLink';
import {
  PLATFORM_ORDER,
  isOfficialTemplate,
  isTemporaryHost,
  loadDraft,
  platformComplete,
  platformFields,
  platformGuide,
  saveDraft,
  toEnvFile,
  webhookUrl,
  type PlatformId,
  type SetupDraft,
  type SetupStep,
} from '../setup/guide';
import styles from './SetupWizard.module.css';

const REPO = 'https://github.com/TencentEdgeOne/agent-for-im';

const UI = {
  zh: {
    brand: '服务初始化与接入引导',
    docs: '接入文档',
    feedback: '支持与反馈',
    steps: ['一键部署', '完善参数', '配置 Webhook', '进入管理端'],
    stepNow: '当前正在进行',
    stepDone: '已完成',
    stepWaitParams: '待配置',
    stepWaitHook: '待绑定回调',
    stepLocked: '前置条件未满足',
    s1kicker: '步骤 1 · 初始化网络环境',
    s1title: '一键部署与域名检查',
    s1lead: '这是官方模板，不能在这里配置渠道。请部署一份自己的实例，再用新域名打开。',
    probeLabel: '当前探测访问入口',
    official: '官方模板',
    temp: '处于默认临时域名',
    bound: '已绑定生产域名',
    s1panel: '接入生产专属域名',
    s1hint: '部署到 EdgeOne 生产环境，或为当前服务挂上自己的域名后再回来检测。',
    deploy: '一键部署到生产',
    recheck: '已绑定，重新检测',
    skipTest: '以测试模式跳过',
    nextParams: '下一步：完善参数',
    s2title: '配置平台凭据与 Webhook 回调',
    s2lead: '选一个要接入的渠道，填入开发者凭证。保存后写入服务端存储，各渠道回调从那里读取。',
    creds: '参数凭据',
    hook: 'Webhook 地址',
    hookHint: '用于接收平台推送事件',
    docsLink: '官方文档',
    copyUrl: '复制地址',
    copied: '已复制',
    save: '保存参数',
    saved: '已写入服务端',
    saveFailed: '写入服务端失败',
    localOnly: '仅在本地，服务端没有这项配置',
    optional: '可选',
    needFields: '请先填完必填项',
    listening: '端点监听',
    probe: '测试联通',
    probing: '检测中…',
    back: '上一步',
    nextHook: '下一步：配置 Webhook',
    s3kicker: '步骤 3 · 绑定官方后台回调',
    s3title: '配置 IM 平台 Webhook',
    s3lead: '把下面的地址填进对应平台的开发者后台。签名校验使用上一步保存的凭证。',
    challenge: '自动 Challenge 响应',
    how: '配置执行步骤',
    eta: '约 1 分钟',
    shortcut: '快捷通道',
    openConsole: '打开开发者后台',
    skipHook: '跳过验证，稍后配置',
    nextReady: '下一步',
    backParams: '上一步：修改基础参数',
    s4kicker: '步骤 4 · 初始化就绪',
    s4title: '服务就绪，进入会话归档控制台',
    s4lead: '确认域名和已填写的渠道，然后进入归档控制台。',
    ready: '全部集成已就绪',
    net: '部署网络',
    channels: '渠道接入',
    archive: '归档引擎',
    archiveHint: '会话会在 IM 消息到达后写入收件箱',
    archiveBadge: '可用',
    secrets: '凭据存放',
    secretsHint: '保存在本机浏览器，可导出 .env 后配到部署环境',
    local: '本机',
    enter: '立即进入管理端控制台',
    enterHint: '进入后可以看到 Slack、飞书、钉钉等渠道归档下来的对话。',
    export: '导出配置文件 .env',
    more: '稍后配置更多渠道',
    backHook: '上一步：检查 Webhook',
    footer: 'Agent for IM Setup Wizard · 多平台会话归档',
    unreachable: '端点无响应',
    reached: '已连通',
  },
  en: {
    brand: 'Setup and channel onboarding',
    docs: 'Docs',
    feedback: 'Feedback',
    steps: ['Deploy', 'Credentials', 'Webhook', 'Console'],
    stepNow: 'In progress',
    stepDone: 'Done',
    stepWaitParams: 'Not filled',
    stepWaitHook: 'Not bound',
    stepLocked: 'Locked',
    s1kicker: 'Step 1 · Network',
    s1title: 'Deploy and check the domain',
    s1lead: 'This is the official template. Channel setup is not available here. Deploy your own copy and open that hostname.',
    probeLabel: 'Detected entry URL',
    official: 'Official template',
    temp: 'Temporary default host',
    bound: 'Production host',
    s1panel: 'Use a production hostname',
    s1hint: 'Deploy on EdgeOne, or attach your own domain and run the check again.',
    deploy: 'Deploy to production',
    recheck: 'Recheck host',
    skipTest: 'Skip in test mode',
    nextParams: 'Next: credentials',
    s2title: 'Platform credentials and webhook',
    s2lead: 'Pick a channel and fill its developer credentials. Save writes them to the server store. Callbacks read from there.',
    creds: 'Credentials',
    hook: 'Webhook URL',
    hookHint: 'Receives platform events',
    docsLink: 'Docs',
    copyUrl: 'Copy URL',
    copied: 'Copied',
    save: 'Save',
    saved: 'Saved on the server',
    saveFailed: 'Could not save to the server',
    localOnly: 'On this device only. The server does not have it.',
    optional: 'optional',
    needFields: 'Fill every required field',
    listening: 'Endpoint',
    probe: 'Test',
    probing: 'Checking…',
    back: 'Back',
    nextHook: 'Next: webhook',
    s3kicker: 'Step 3 · Bind the callback',
    s3title: 'Configure the IM webhook',
    s3lead: 'Paste the URL into the vendor console. Signature checks use the credentials saved in the previous step.',
    challenge: 'Challenge response',
    how: 'Setup steps',
    eta: 'About 1 min',
    shortcut: 'Links',
    openConsole: 'Open developer console',
    skipHook: 'Skip for now',
    nextReady: 'Next',
    backParams: 'Back: edit credentials',
    s4kicker: 'Step 4 · Ready',
    s4title: 'Ready for the archive console',
    s4lead: 'Review the host and the channels you filled in, then open the console.',
    ready: 'Setup complete',
    net: 'Network',
    channels: 'Channels',
    archive: 'Archive',
    archiveHint: 'Threads show up in the inbox after an IM message arrives',
    archiveBadge: 'Ready',
    secrets: 'Credentials',
    secretsHint: 'Stored in this browser. Export .env and add it to the deployment.',
    local: 'Local',
    enter: 'Enter the console',
    enterHint: 'The console lists archived threads from Slack, Feishu, DingTalk, and the other channels.',
    export: 'Export .env',
    more: 'Configure more channels',
    backHook: 'Back: check webhook',
    footer: 'Agent for IM Setup Wizard · multi-channel archive',
    unreachable: 'No response',
    reached: 'Reachable',
  },
} as const;

type Probe = { status: number; ms: number } | 'error' | null;

export default function SetupWizard({ onEnter }: { onEnter: () => void }) {
  const { lang, setLang } = useT();
  const t = UI[lang];
  const official = isOfficialTemplate(window.location.hostname);
  const [draft, setDraft] = useState<SetupDraft>(() => {
    const loaded = loadDraft();
    if (official) return { ...loaded, step: 1, entered: false };
    if (loaded.step === 1) return { ...loaded, step: 2 };
    return loaded;
  });
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [probe, setProbe] = useState<Probe>(null);
  const [probing, setProbing] = useState(false);
  const [serverValues, setServerValues] = useState<Record<string, string>>({});
  const [serverChecked, setServerChecked] = useState(false);
  const dirty = useRef(false);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const temporary = isTemporaryHost(window.location.hostname);
  const guide = platformGuide(draft.platform, lang);
  const url = webhookUrl(origin, guide.path);

  const persist = (next: SetupDraft) => {
    setDraft(next);
    saveDraft(next);
  };

  const go = (step: SetupStep, extra?: Partial<SetupDraft>) => {
    if (official && step !== 1) return;
    if (!official && step === 1) return;
    persist({ ...draft, ...extra, step });
    setNotice('');
    setProbe(null);
  };

  const applyRemote = (remote: ImSettings) => {
    setServerValues(remote.values);
    setDraft((prev) => {
      const values = { ...prev.values };
      for (const [key, value] of Object.entries(remote.values)) {
        if (value) values[key] = value;
      }
      const saved = PLATFORM_ORDER.filter((id) => remote.configured[id]);
      const next = { ...prev, values, saved };
      saveDraft(next);
      return next;
    });
  };

  const savePlatform = async () => {
    if (!platformComplete(draft.platform, draft.values)) {
      setNotice(t.needFields);
      return;
    }
    const values: Record<string, string> = {};
    for (const field of platformFields(draft.platform)) values[field.key] = (draft.values[field.key] || '').trim();
    const remote = await saveImSettings(values);
    if (!remote.ok) {
      setNotice(remote.message || t.saveFailed);
      return;
    }
    dirty.current = false;
    applyRemote(remote.settings);
    setNotice(t.saved);
  };

  useEffect(() => {
    void fetchImSettings().then((remote) => {
      if (remote.ok && !dirty.current) applyRemote(remote.settings);
      else if (remote.ok) setServerValues(remote.settings.values);
      setServerChecked(true);
    });
  }, []);

  const setField = (key: string, value: string) => {
    dirty.current = true;
    const saved = draft.saved.filter((id) => id !== draft.platform);
    persist({ ...draft, saved, values: { ...draft.values, [key]: value } });
    setNotice('');
  };

  const copyUrl = async () => {
    const ok = await copyText(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const runProbe = async () => {
    setProbing(true);
    const started = Date.now();
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setProbe({ status: res.status, ms: Date.now() - started });
    } catch {
      setProbe('error');
    } finally {
      setProbing(false);
    }
  };

  const enter = () => {
    if (official) return;
    persist({ ...draft, entered: true });
    onEnter();
  };

  useEffect(() => {
    if (draft.step !== 4) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return;
      enter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stepMeta = useMemo(() => t.steps.map((label, index) => {
    const n = (index + 1) as SetupStep;
    const done = draft.step > n;
    const current = draft.step === n;
    let detail: string = t.stepLocked;
    if (current) detail = t.stepNow;
    else if (done) detail = t.stepDone;
    else if (n === 2) detail = t.stepWaitParams;
    else if (n === 3) detail = t.stepWaitHook;
    return { n, label, done, current, detail };
  }), [draft.step, t]);

  const savedCount = draft.saved.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>⬡</span>
          <strong>Agent for IM</strong>
          <em>{t.brand}</em>
        </div>
        <div className={styles.headerRight}>
          <a href={REPO} target="_blank" rel="noreferrer">{t.docs}</a>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">{t.feedback}</a>
          <div className={styles.lang}>
            <button type="button" className={lang === 'zh' ? styles.langOn : ''} onClick={() => setLang('zh')}>ZH</button>
            <span>/</span>
            <button type="button" className={lang === 'en' ? styles.langOn : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <span className={styles.avatar}>AI</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.steps} style={{ gridTemplateColumns: `repeat(${official ? 1 : 3}, 1fr)` }}>
          {stepMeta.filter((step) => (official ? step.n === 1 : step.n !== 1)).map((step, index) => (
            <button
              key={step.n}
              type="button"
              className={`${styles.step} ${step.current ? styles.stepOn : ''} ${step.done ? styles.stepDone : ''}`}
              disabled={!step.done && !step.current}
              onClick={() => step.done && go(step.n)}
            >
              <span className={styles.stepTop}>
                STEP 0{index + 1}
                {step.current ? <i className={styles.dot} /> : <span>{step.done ? '✓' : '○'}</span>}
              </span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </button>
          ))}
        </div>

        {official && draft.step === 1 && (
          <section className={styles.card}>
            <span className={styles.kicker}>{t.s1kicker}</span>
            <h1>{t.s1title}</h1>
            <p className={styles.lead}>{t.s1lead}</p>
            <div className={styles.probe}>
              <div>
                <small>{t.probeLabel}</small>
                <span className={styles.mono}>{origin}</span>
              </div>
              <span className={`${styles.badge} ${styles.bad}`}>{t.official}</span>
            </div>
            <div className={styles.panel}>
              <h2>{t.s1panel}</h2>
              <p>{t.s1hint}</p>
              <div className={styles.row}>
                <a className={styles.primary} href={getDeployUrl()} target="_blank" rel="noreferrer">{t.deploy}</a>
              </div>
            </div>
          </section>
        )}

        {!official && draft.step === 2 && (
          <section>
            <div className={styles.titleRow}>
              <div>
                <h1>{t.s2title}</h1>
                <p className={styles.lead}>{t.s2lead}</p>
              </div>
            </div>
            <PlatformTabs
              lang={lang}
              active={draft.platform}
              saved={draft.saved}
              onPick={(platform) => persist({ ...draft, platform })}
            />
            <div className={styles.split}>
              <div className={styles.block}>
                <div>
                  <div className={styles.blockHead}>
                    <div>
                      <h2>{t.creds}</h2>
                      <small>{guide.label}</small>
                    </div>
                    <span className={styles.chip}>{guide.badge}</span>
                  </div>
                  {platformFields(draft.platform).map((field) => (
                    <div className={styles.field} key={field.key}>
                      <label>
                        <span>{field.label} {field.optional ? t.optional : <b>*</b>}</span>
                        <span className={styles.hint}>{field.hint}</span>
                      </label>
                      <div className={styles.secret}>
                        <input
                          type={revealed[field.key] ? 'text' : 'password'}
                          spellCheck={false}
                          autoComplete="off"
                          value={draft.values[field.key] || ''}
                          onChange={(event) => setField(field.key, event.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.eye}
                          onClick={() => setRevealed((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          aria-label={field.label}
                        >
                          {revealed[field.key] ? 'hide' : 'show'}
                        </button>
                      </div>
                      {serverChecked && (draft.values[field.key] || '').trim() && !(serverValues[field.key] || '').trim() ? (
                        <p className={styles.localOnly}>{t.localOnly}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className={styles.nav}>
                  <span className={styles.saved}>{notice}</span>
                  <button type="button" className={styles.ghost} onClick={() => void savePlatform()}>{t.save}</button>
                </div>
              </div>
              <WebhookCard
                title={t.hook}
                hint={t.hookHint}
                docsLabel={t.docsLink}
                docs={guide.docs}
                url={url}
                copyLabel={copied ? t.copied : t.copyUrl}
                onCopy={() => void copyUrl()}
                note={guide.paste}
                listening={t.listening}
                probeLabel={probing ? t.probing : probeLabel(probe, t)}
                onProbe={() => void runProbe()}
              />
            </div>
            <div className={styles.nav}>
              <span />
              <button type="button" className={styles.primary} onClick={() => go(3)}>{t.nextHook}</button>
            </div>
          </section>
        )}

        {!official && draft.step === 3 && (
          <section>
            <span className={styles.kicker}>{t.s3kicker}</span>
            <div className={styles.titleRow}>
              <div>
                <h1>{t.s3title}</h1>
                <p className={styles.lead}>{t.s3lead}</p>
              </div>
            </div>
            <PlatformTabs
              lang={lang}
              active={draft.platform}
              saved={draft.saved}
              onPick={(platform) => {
                persist({ ...draft, platform });
                setProbe(null);
              }}
            />
            <div className={styles.guide}>
              <div className={styles.block}>
                <WebhookCard
                  title={`${guide.label} Request URL`}
                  hint="HTTPS"
                  docsLabel={t.docsLink}
                  docs={guide.docs}
                  url={url}
                  copyLabel={copied ? t.copied : t.copyUrl}
                  onCopy={() => void copyUrl()}
                  note={guide.paste}
                  listening={t.listening}
                  probeLabel={probing ? t.probing : probeLabel(probe, t)}
                  onProbe={() => void runProbe()}
                />
                <div className={styles.note}>
                  <span>{t.challenge}</span>
                  <span>{guide.challenge}</span>
                </div>
              </div>
              <div className={styles.block}>
                <div className={styles.blockHead}>
                  <h2>{t.how}</h2>
                  <small>{t.eta}</small>
                </div>
                {guide.steps.map((step, index) => (
                  <div className={styles.guideStep} key={step.title}>
                    <span className={styles.num}>{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{guideBody(step.body)}</p>
                    </div>
                  </div>
                ))}
                <div className={styles.note}>
                  <span>{t.shortcut}</span>
                  <a className={styles.link} href={guide.docs} target="_blank" rel="noreferrer">{t.openConsole}</a>
                </div>
              </div>
            </div>
            <div className={styles.nav}>
              <button type="button" className={styles.textBtn} onClick={() => go(2)}>{t.backParams}</button>
              <div className={styles.row}>
                <button type="button" className={styles.ghost} onClick={() => go(4)}>{t.skipHook}</button>
                <button type="button" className={styles.primary} onClick={() => go(4)}>{t.nextReady}</button>
              </div>
            </div>
          </section>
        )}

        {!official && draft.step === 4 && (
          <section className={styles.ready}>
            <span className={styles.kicker}>{t.s4kicker}</span>
            <h1>{t.s4title}</h1>
            <p className={styles.lead}>{t.s4lead}</p>
            <div className={`${styles.card} ${styles.ready}`}>
              <div className={styles.hex} aria-hidden>✓</div>
              <div className={styles.status}>ALL SYSTEMS OPERATIONAL</div>
              <h2>{t.ready}</h2>
              <div className={styles.list}>
                <Check
                  title={t.net}
                  detail={window.location.hostname}
                  badge={temporary && !draft.testMode ? t.temp : t.bound}
                />
                <Check
                  title={t.channels}
                  detail={savedNames(draft.saved, lang) || '—'}
                  badge={`${savedCount}/${PLATFORM_ORDER.length}`}
                />
                <Check title={t.archive} detail={t.archiveHint} badge={t.archiveBadge} />
                <Check title={t.secrets} detail={t.secretsHint} badge={t.local} />
              </div>
              <button type="button" className={`${styles.primary} ${styles.wide}`} onClick={enter}>{t.enter}</button>
              <p className={styles.lead}>{t.enterHint}</p>
              <div className={styles.aux}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => downloadFile('agent-for-im.env', toEnvFile(draft.values), 'text/plain')}
                >
                  {t.export}
                </button>
                <button type="button" className={styles.textBtn} onClick={() => go(2)}>{t.more}</button>
              </div>
            </div>
            <div className={styles.nav}>
              <button type="button" className={styles.textBtn} onClick={() => go(3)}>{t.backHook}</button>
              <span className={styles.hint}>Enter</span>
            </div>
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <span>{t.footer}</span>
        <span>READY</span>
      </footer>
    </div>
  );
}

function guideBody(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    if (!match) return part;
    return (
      <a key={index} className={styles.inlineLink} href={match[2]} target="_blank" rel="noreferrer">
        {match[1]}
      </a>
    );
  });
}

function probeLabel(probe: Probe, t: (typeof UI)['zh'] | (typeof UI)['en']): string {
  if (!probe) return t.probe;
  if (probe === 'error') return t.unreachable;
  return `${t.reached} HTTP ${probe.status} · ${probe.ms}ms`;
}

function savedNames(saved: PlatformId[], lang: 'zh' | 'en'): string {
  return saved.map((id) => platformGuide(id, lang).label).join(' · ');
}

function PlatformTabs({
  lang,
  active,
  saved,
  onPick,
}: {
  lang: 'zh' | 'en';
  active: PlatformId;
  saved: PlatformId[];
  onPick: (id: PlatformId) => void;
}) {
  return (
    <div className={styles.tabs}>
      {PLATFORM_ORDER.map((id) => {
        const item = platformGuide(id, lang);
        const on = id === active;
        return (
          <button key={id} type="button" className={`${styles.tab} ${on ? styles.tabOn : ''}`} onClick={() => onPick(id)}>
            <i className={`${styles.gem} ${saved.includes(id) ? styles.gemOn : ''}`} />
            {item.label}
            {on && <span className={styles.hint}>ACTIVE</span>}
          </button>
        );
      })}
    </div>
  );
}

function WebhookCard({
  title,
  hint,
  docs,
  docsLabel,
  url,
  copyLabel,
  onCopy,
  note,
  listening,
  probeLabel: probeText,
  onProbe,
}: {
  title: string;
  hint: string;
  docs: string;
  docsLabel: string;
  url: string;
  copyLabel: string;
  onCopy: () => void;
  note: string;
  listening: string;
  probeLabel: string;
  onProbe: () => void;
}) {
  return (
    <div className={styles.block}>
      <div>
        <div className={styles.blockHead}>
          <div>
            <h2>{title}</h2>
            <small>{hint}</small>
          </div>
          <a className={styles.link} href={docs} target="_blank" rel="noreferrer">{docsLabel}</a>
        </div>
        <div className={styles.urlBox}>
          <small className={styles.hint}>PUBLIC EVENT URL</small>
          <div className={styles.urlLine}>
            <code>{url}</code>
            <button type="button" className={styles.primary} onClick={onCopy}>{copyLabel}</button>
          </div>
        </div>
        <p className={styles.note}>{note}</p>
      </div>
      <div className={styles.nav}>
        <span className={styles.hint}>{listening}</span>
        <button type="button" className={styles.ghost} onClick={onProbe}>{probeText}</button>
      </div>
    </div>
  );
}

function Check({ title, detail, badge }: { title: string; detail: string; badge: string }) {
  return (
    <div className={styles.item}>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <span className={`${styles.badge} ${styles.good}`}>{badge}</span>
    </div>
  );
}
