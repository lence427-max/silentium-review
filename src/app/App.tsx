import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { BackupPayload, Mistake, MistakeImage, QuestionType, Result, ReviewAction, ReviewRecord, Subject } from '../types';
import { ERROR_REASONS, QUESTION_TYPE_LABELS, RESULT_LABELS, SUBJECT_LABELS, SUBJECT_MODULES } from '../domain/constants';
import { calculateInitialReviewDate, applyReviewAction } from '../domain/reviewSchedule';
import { buildStats, buildStudyTips } from '../domain/statistics';
import { compressImage } from '../domain/imageCompression';
import { createImportSummary, parseBackupPayload } from '../domain/backup';
import {
  clearAllData,
  clearDemoData,
  deleteMistake,
  exportBackup,
  generateDemoData,
  getAllData,
  importBackup,
  saveMistake,
  saveStudyLog,
  updateMistakeWithReview
} from '../data/repository';
import { toDateKey } from '../domain/date';

type Page = 'dashboard' | 'add' | 'review' | 'mistakes' | 'stats' | 'settings';

const NAV_ITEMS: Array<[Page, string]> = [
  ['dashboard', '首页'],
  ['add', '添加'],
  ['review', '复盘'],
  ['mistakes', '错题'],
  ['stats', '统计'],
  ['settings', '备份']
];

type AppData = Awaited<ReturnType<typeof getAllData>>;

const emptyData: AppData = {
  mistakes: [],
  images: [],
  reviewRecords: [],
  studyLogs: [],
  settings: null
};

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [data, setData] = useState<AppData>(emptyData);
  const [selectedMistakeId, setSelectedMistakeId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    setData(await getAllData());
  }

  useEffect(() => {
    refresh().catch(() => setMessage('读取本地数据失败'));
  }, []);

  const stats = useMemo(() => buildStats(data.mistakes, data.studyLogs), [data]);
  const studyTips = useMemo(() => buildStudyTips(stats), [stats]);
  const imageMap = useMemo(() => new Map(data.images.map((image) => [image.id, image])), [data.images]);

  return (
    <div className="app">
      <aside className="desktop-sidebar">
        <div>
          <p className="eyebrow">静研录</p>
          <h1>Silentium Review</h1>
          <p className="subtitle">把每一道错题变成提分点。</p>
        </div>
        <nav className="desktop-nav" aria-label="桌面导航">
          {NAV_ITEMS.map(([key, label]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              {label}
            </button>
          ))}
        </nav>
        <p className="sidebar-note">静下来，把错题变成线索。</p>
      </aside>

      <div className="content-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">静研录</p>
            <h1>Silentium Review</h1>
            <p className="subtitle">把每一道错题变成提分点。</p>
          </div>
          <button className="ghost-button" onClick={() => setPage('add')}>
            快速添加
          </button>
        </header>

        {message && (
          <div className="toast" role="status" onClick={() => setMessage('')}>
            {message}
          </div>
        )}

        <main className="main-panel">
          {page === 'dashboard' && (
            <Dashboard
              stats={stats}
              tips={studyTips}
              hasMistakes={data.mistakes.length > 0}
              onAdd={() => setPage('add')}
              onReview={() => setPage('review')}
            />
          )}
          {page === 'add' && <AddMistake onSaved={refresh} setMessage={setMessage} onGoHome={() => setPage('dashboard')} />}
          {page === 'review' && <ReviewToday mistakes={data.mistakes} reviewRecords={data.reviewRecords} imageMap={imageMap} onReviewed={refresh} setMessage={setMessage} />}
          {page === 'mistakes' && (
            <MistakeList
              mistakes={data.mistakes}
              imageMap={imageMap}
              selectedMistakeId={selectedMistakeId}
              onSelect={setSelectedMistakeId}
              onDeleted={refresh}
              setMessage={setMessage}
            />
          )}
          {page === 'stats' && <StatsPanel stats={stats} />}
          {page === 'settings' && <SettingsPanel demoCount={data.mistakes.filter((mistake) => mistake.isDemo).length} onChanged={refresh} setMessage={setMessage} />}
        </main>

        <aside className="desktop-aside">
          <Insight title="高频错因" item={stats.mostFrequentReason} empty="暂无错因" />
          <Insight title="薄弱模块" item={stats.weakestModule} empty="暂无模块" />
          <article className="panel quiet-card">
            <h2>快捷入口</h2>
            <button className="primary-button" onClick={() => setPage('add')}>添加错题</button>
          </article>
          <article className="panel quiet-card">
            <h2>备份提醒</h2>
            <p className="muted">数据保存在当前浏览器，建议定期导出备份。</p>
          </article>
          <RotatingTip tips={studyTips} />
        </aside>
      </div>

      <nav className="bottom-nav" aria-label="主导航">
        {NAV_ITEMS.map(([key, label]) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({
  stats,
  tips,
  hasMistakes,
  onAdd,
  onReview
}: {
  stats: ReturnType<typeof buildStats>;
  tips: string[];
  hasMistakes: boolean;
  onAdd: () => void;
  onReview: () => void;
}) {
  return (
    <section className="dashboard-grid">
      {!hasMistakes && <FirstUseGuide onAdd={onAdd} />}

      <article className="focus-card">
        <p className="section-kicker">今日复盘</p>
        <button className="review-card" onClick={onReview}>
          <span>今日待复盘</span>
          <strong>{stats.todayReviewCount}</strong>
          <em>{stats.todayReviewCount > 0 ? '先复盘。' : '暂无复盘。'}</em>
        </button>
      </article>

      <div className="metric-grid">
        <Metric label="本周刷题" value={stats.weeklyTotalCount} />
        <Metric label="本周错题" value={stats.weeklyWrongCount} />
      </div>

      <div className="insight-grid">
        <Insight title="高频错因" item={stats.mostFrequentReason} empty="暂无错因" />
        <Insight title="薄弱模块" item={stats.weakestModule} empty="暂无模块" />
      </div>

      <article className="advice-card">
        <p className="section-kicker">下一步</p>
        <h2>{stats.nextAdvice}</h2>
      </article>

      <RotatingTip tips={tips} />

      <BackupNotice />

      <button className="primary-button" onClick={onAdd}>
        添加一道错题
      </button>
    </section>
  );
}

function FirstUseGuide({ onAdd }: { onAdd: () => void }) {
  return (
    <article className="starter-card">
      <p className="section-kicker">从第一道错题开始。</p>
      <h2>拍题、选错因、写一句复盘。</h2>
      <ol>
        <li>添加一道错题</li>
        <li>选择错因</li>
        <li>写一句复盘</li>
        <li>按时复盘</li>
      </ol>
      <p className="muted">明天回来复盘它。</p>
      <button className="primary-button" onClick={onAdd}>添加第一题</button>
    </article>
  );
}

function BackupNotice() {
  return (
    <article className="backup-note">
      <h2>备份提醒</h2>
      <p className="muted">数据保存在当前浏览器，建议定期导出 JSON 备份。</p>
    </article>
  );
}

function RotatingTip({ tips }: { tips: string[] }) {
  const [index, setIndex] = useState(0);
  const current = tips[index % tips.length] ?? '从一道错题开始。';

  useEffect(() => {
    setIndex(0);
  }, [tips]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % tips.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [tips.length]);

  return (
    <article className="tip-card" aria-live="polite">
      <p className="section-kicker">静研提示</p>
      <h2>{current}</h2>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Insight({ title, item, empty }: { title: string; item: { label: string; count: number } | null; empty: string }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      {item ? (
        <p className="big-line">
          {item.label}
          <span>{item.count} 次</span>
        </p>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </article>
  );
}

function AddMistake({
  onSaved,
  setMessage,
  onGoHome
}: {
  onSaved: () => Promise<void>;
  setMessage: (value: string) => void;
  onGoHome: () => void;
}) {
  const [subject, setSubject] = useState<Subject>('math');
  const [module, setModule] = useState(SUBJECT_MODULES.math[0]);
  const [questionType, setQuestionType] = useState<QuestionType>('calculation');
  const [result, setResult] = useState<Result>('wrong');
  const [reason, setReason] = useState(ERROR_REASONS[2]);
  const [reflection, setReflection] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<MistakeImage | undefined>();
  const [saving, setSaving] = useState(false);
  const [lastNextReviewAt, setLastNextReviewAt] = useState<string | null>(null);

  function changeSubject(next: Subject) {
    setSubject(next);
    setModule(SUBJECT_MODULES[next][0]);
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage({
        id: crypto.randomUUID(),
        name: file.name,
        type: compressed.blob.type,
        blob: compressed.blob,
        width: compressed.width,
        height: compressed.height,
        size: compressed.blob.size,
        createdAt: new Date().toISOString()
      });
      setMessage('图片已压缩');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片处理失败');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reflection.trim()) {
      setMessage('请写一句复盘提示');
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const mistake: Mistake = {
      id: crypto.randomUUID(),
      subject,
      module,
      questionType,
      result,
      reason,
      reflection: reflection.trim(),
      note: note.trim() || undefined,
      questionImageId: image?.id,
      createdAt: now,
      updatedAt: now,
      reviewStage: 0,
      nextReviewAt: calculateInitialReviewDate(now),
      masteryStatus: result === 'mastered' ? 'mastered' : 'reviewing',
      isKeyMistake: false
    };
    await saveMistake(mistake, image);
    await saveStudyLog({
      id: crypto.randomUUID(),
      date: toDateKey(now),
      subject,
      totalCount: 1,
      wrongCount: result === 'mastered' ? 0 : 1,
      createdAt: now,
      updatedAt: now
    });
    setReflection('');
    setNote('');
    setImage(undefined);
    setLastNextReviewAt(mistake.nextReviewAt);
    setSaving(false);
    await onSaved();
    setMessage(`保存成功，下次复盘：${mistake.nextReviewAt ? toDateKey(mistake.nextReviewAt) : '无需复盘'}`);
  }

  return (
    <form className="stack form" onSubmit={submit}>
      {lastNextReviewAt && (
        <article className="success-card">
          <p className="section-kicker">保存成功</p>
          <h2>已安排 {toDateKey(lastNextReviewAt)} 复盘。</h2>
          <div className="action-grid compact-actions">
            <button type="button" onClick={() => setLastNextReviewAt(null)}>继续添加</button>
            <button type="button" onClick={onGoHome}>返回首页</button>
          </div>
        </article>
      )}
      <section className="form-section photo-section">
        <p className="section-kicker">1. 题目图片</p>
        <ImageInput image={image} onImage={onImage} />
      </section>
      <section className="form-section">
        <p className="section-kicker">2. 科目与模块</p>
        <ChoiceGroup label="科目" value={subject} options={SUBJECT_LABELS} onChange={(value) => changeSubject(value as Subject)} />
        <ChoiceGroup label="模块" value={module} options={Object.fromEntries(SUBJECT_MODULES[subject].map((item) => [item, item]))} onChange={setModule} />
      </section>
      <section className="form-section">
        <p className="section-kicker">3. 题型与结果</p>
        <ChoiceGroup label="题型" value={questionType} options={QUESTION_TYPE_LABELS} onChange={(value) => setQuestionType(value as QuestionType)} />
        <ChoiceGroup label="结果" value={result} options={RESULT_LABELS} onChange={(value) => setResult(value as Result)} />
      </section>
      <section className="form-section">
        <p className="section-kicker">4. 错误原因</p>
        <ChoiceGroup label="错误原因" value={reason} options={Object.fromEntries(ERROR_REASONS.map((item) => [item, item]))} onChange={setReason} />
      </section>
      <section className="form-section">
        <p className="section-kicker">5. 复盘一句话</p>
        <label className="field">
          <span>下次遇到这种题，我应该...</span>
          <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="例如：先列条件，再检查符号和边界。" rows={3} />
        </label>
      </section>
      <section className="form-section">
        <p className="section-kicker">6. 可选备注</p>
        <label className="field">
          <span>补充思路、页码或提醒</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可空，别让录入变重。" rows={2} />
        </label>
      </section>
      <button className="primary-button" disabled={saving}>
        {saving ? '保存中...' : '保存错题'}
      </button>
    </form>
  );
}

function ImageInput({ image, onImage }: { image?: MistakeImage; onImage: (file?: File) => void }) {
  return (
    <label className="image-input">
      <span>{image ? '已选择题目图片' : '拍照或上传题目图片'}</span>
      <small>{image ? `${Math.round(image.size / 1024)} KB` : '手机端可直接调用相机'}</small>
      <input type="file" accept="image/*" capture="environment" onChange={(event) => onImage(event.target.files?.[0])} />
    </label>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div>
        {Object.entries(options).map(([key, labelText]) => (
          <button type="button" key={key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>
            {labelText}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewToday({
  mistakes,
  reviewRecords,
  imageMap,
  onReviewed,
  setMessage
}: {
  mistakes: Mistake[];
  reviewRecords: ReviewRecord[];
  imageMap: Map<string, MistakeImage>;
  onReviewed: () => Promise<void>;
  setMessage: (value: string) => void;
}) {
  const recordsByMistake = useMemo(() => {
    const map = new Map<string, ReviewRecord[]>();
    for (const record of reviewRecords) {
      const records = map.get(record.mistakeId) ?? [];
      records.push(record);
      map.set(record.mistakeId, records);
    }
    for (const records of map.values()) {
      records.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
    }
    return map;
  }, [reviewRecords]);
  const due = mistakes.filter((mistake) => {
    if (!mistake.nextReviewAt || mistake.masteryStatus === 'mastered') return false;
    return new Date(mistake.nextReviewAt) <= new Date();
  });

  async function review(mistake: Mistake, action: Parameters<typeof applyReviewAction>[1]) {
    const result = applyReviewAction(mistake, action, new Date().toISOString());
    await updateMistakeWithReview(result.nextMistake, result.record);
    await onReviewed();
    setMessage('复盘记录已更新');
  }

  if (due.length === 0) {
    return <Empty title="今日无复盘" text="继续刷题，保持节奏。" />;
  }

  return (
    <section className="stack">
      <article className="advice-card">
        <p className="section-kicker">今日复盘</p>
        <h2>先看题，再看提醒。</h2>
      </article>
      {due.map((mistake) => (
        <MistakeReviewCard
          key={mistake.id}
          mistake={mistake}
          image={mistake.questionImageId ? imageMap.get(mistake.questionImageId) : undefined}
          lastRecord={recordsByMistake.get(mistake.id)?.[0]}
          onReview={review}
        />
      ))}
    </section>
  );
}

function MistakeReviewCard({
  mistake,
  image,
  lastRecord,
  onReview
}: {
  mistake: Mistake;
  image?: MistakeImage;
  lastRecord?: ReviewRecord;
  onReview: (mistake: Mistake, action: Parameters<typeof applyReviewAction>[1]) => void;
}) {
  return (
    <article className="panel review-item">
      <MistakeImageView image={image} />
      <p className="meta">
        {SUBJECT_LABELS[mistake.subject]} / {mistake.module} / {QUESTION_TYPE_LABELS[mistake.questionType]}
      </p>
      <h2>{mistake.reflection}</h2>
      <div className="review-facts">
        <span>错因：{mistake.reason}</span>
        <span>上次状态：{lastRecord ? REVIEW_ACTION_LABELS[lastRecord.action] : '首次复盘'}</span>
      </div>
      <div className="action-grid">
        <button onClick={() => onReview(mistake, 'mastered')}>这次掌握了</button>
        <button onClick={() => onReview(mistake, 'still_unknown')}>还要再看</button>
        <button onClick={() => onReview(mistake, 'third_round')}>列入三刷</button>
        <button onClick={() => onReview(mistake, 'skipped')}>今天先跳过</button>
      </div>
    </article>
  );
}

const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  mastered: '已掌握',
  still_unknown: '仍不会',
  third_round: '需要三刷',
  skipped: '暂时跳过'
};

function MistakeList({
  mistakes,
  imageMap,
  selectedMistakeId,
  onSelect,
  onDeleted,
  setMessage
}: {
  mistakes: Mistake[];
  imageMap: Map<string, MistakeImage>;
  selectedMistakeId: string | null;
  onSelect: (id: string | null) => void;
  onDeleted: () => Promise<void>;
  setMessage: (value: string) => void;
}) {
  const [subject, setSubject] = useState('all');
  const [module, setModule] = useState('all');
  const [reason, setReason] = useState('all');
  const [status, setStatus] = useState('all');
  const selected = mistakes.find((mistake) => mistake.id === selectedMistakeId);
  const filtered = mistakes.filter((mistake) => {
    return (
      (subject === 'all' || mistake.subject === subject) &&
      (module === 'all' || mistake.module === module) &&
      (reason === 'all' || mistake.reason === reason) &&
      (status === 'all' || mistake.masteryStatus === status)
    );
  });

  async function remove(mistake: Mistake) {
    if (!confirm('确认删除这道错题吗？删除后无法恢复。')) return;
    await deleteMistake(mistake.id);
    onSelect(null);
    await onDeleted();
    setMessage('错题已删除');
  }

  return (
    <section className="stack">
      <div className="filters">
        <select value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="all">全部科目</option>
          {Object.entries(SUBJECT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select value={module} onChange={(event) => setModule(event.target.value)}>
          <option value="all">全部模块</option>
          {[...new Set(mistakes.map((mistake) => mistake.module))].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="all">全部错因</option>
          {ERROR_REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部状态</option>
          <option value="reviewing">复盘中</option>
          <option value="mastered">已掌握</option>
          <option value="unmastered">未掌握</option>
        </select>
      </div>

      {selected && <MistakeDetail mistake={selected} image={selected.questionImageId ? imageMap.get(selected.questionImageId) : undefined} onClose={() => onSelect(null)} onDelete={remove} />}

      {filtered.length === 0 ? (
        <Empty title="暂无错题" text="从一道开始。" />
      ) : (
        filtered.map((mistake) => (
          <button className="mistake-row" key={mistake.id} onClick={() => onSelect(mistake.id)}>
            <span>{SUBJECT_LABELS[mistake.subject]} / {mistake.module}</span>
            <strong>{mistake.reason}</strong>
            <em>{mistake.masteryStatus === 'mastered' ? '已掌握' : mistake.nextReviewAt ? `下次 ${toDateKey(mistake.nextReviewAt)}` : '无需复盘'}</em>
          </button>
        ))
      )}
    </section>
  );
}

function MistakeDetail({
  mistake,
  image,
  onClose,
  onDelete
}: {
  mistake: Mistake;
  image?: MistakeImage;
  onClose: () => void;
  onDelete: (mistake: Mistake) => void;
}) {
  return (
    <article className="panel detail">
      <div className="row-between">
        <h2>错题详情</h2>
        <button className="text-button" onClick={onClose}>收起</button>
      </div>
      <MistakeImageView image={image} />
      <p className="meta">
        {SUBJECT_LABELS[mistake.subject]} / {mistake.module} / {QUESTION_TYPE_LABELS[mistake.questionType]}
      </p>
      <p><strong>结果：</strong>{RESULT_LABELS[mistake.result]}</p>
      <p><strong>错因：</strong>{mistake.reason}</p>
      <p><strong>复盘：</strong>{mistake.reflection}</p>
      {mistake.note && <p><strong>备注：</strong>{mistake.note}</p>}
      <p><strong>下次复盘：</strong>{mistake.nextReviewAt ? toDateKey(mistake.nextReviewAt) : '无'}</p>
      <button className="danger-button" onClick={() => onDelete(mistake)}>删除错题</button>
    </article>
  );
}

function StatsPanel({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <section className="stack">
      <article className="advice-card">
        <p className="section-kicker">本周复盘建议</p>
        <h2>{stats.nextAdvice}</h2>
      </article>
      <div className="metric-grid">
        <Metric label="本周刷题" value={stats.weeklyTotalCount} />
        <Metric label="本周错题" value={stats.weeklyWrongCount} />
      </div>
      <Ranking title="各科错题数量" items={stats.subjectWrongCounts} />
      <Ranking title="错误原因排行" items={stats.reasonRanking} />
      <Ranking title="薄弱模块排行" items={stats.moduleRanking} />
    </section>
  );
}

function Ranking({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">暂无统计数据</p>
      ) : (
        <div className="ranking">
          {items.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function SettingsPanel({
  demoCount,
  onChanged,
  setMessage
}: {
  demoCount: number;
  onChanged: () => Promise<void>;
  setMessage: (value: string) => void;
}) {
  const [summary, setSummary] = useState<ReturnType<typeof createImportSummary> | null>(null);
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);

  async function downloadBackup() {
    const payload = await exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `silentium-review-${toDateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('备份已导出');
  }

  async function chooseBackup(file?: File) {
    if (!file) return;
    try {
      const payload = parseBackupPayload(await file.text());
      setPendingPayload(payload);
      setSummary(createImportSummary(payload));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    }
  }

  async function confirmImport(clearFirst: boolean) {
    if (!pendingPayload) return;
    if (clearFirst && !confirm('这会先清空当前所有数据，再导入备份。请再次确认。')) return;
    await importBackup(pendingPayload, clearFirst);
    setPendingPayload(null);
    setSummary(null);
    await onChanged();
    setMessage('备份已导入');
  }

  async function clearData() {
    if (!confirm('确认清空所有错题、图片、复盘和统计数据吗？')) return;
    if (!confirm('二次确认：清空后无法恢复，除非你已有 JSON 备份。')) return;
    await clearAllData();
    await onChanged();
    setMessage('本地数据已清空');
  }

  async function createDemoData() {
    const text = demoCount > 0 ? '已有示例数据，会刷新示例内容，不会新增很多条。继续吗？' : '生成 4 条示例数据用于预览首页和统计吗？';
    if (!confirm(text)) return;
    await generateDemoData();
    await onChanged();
    setMessage('示例数据已生成');
  }

  async function removeDemoData() {
    if (demoCount === 0) {
      setMessage('暂无示例数据');
      return;
    }
    if (!confirm('只清除示例数据，真实错题会保留。继续吗？')) return;
    await clearDemoData();
    await onChanged();
    setMessage('示例数据已清除');
  }

  return (
    <section className="stack">
      <BackupNotice />

      <article className="panel">
        <h2>JSON 备份</h2>
        <p className="muted">包含错题、图片和复盘记录。换浏览器、清缓存、换电脑前一定要导出。</p>
        <button className="primary-button" onClick={downloadBackup}>导出 JSON</button>
      </article>

      <label className="image-input">
        <span>选择 JSON 备份导入</span>
        <small>导入前先确认摘要</small>
        <input type="file" accept="application/json,.json" onChange={(event) => chooseBackup(event.target.files?.[0])} />
      </label>

      {summary && (
        <article className="panel">
          <h2>导入摘要</h2>
          <p>错题 {summary.mistakes} 条，图片 {summary.images} 张，复盘 {summary.reviewRecords} 条，刷题记录 {summary.studyLogs} 条。</p>
          <div className="action-grid">
            <button onClick={() => confirmImport(false)}>合并导入</button>
            <button onClick={() => confirmImport(true)}>清空后导入</button>
          </div>
        </article>
      )}

      <article className="panel">
        <h2>示例数据</h2>
        <p className="muted">用于预览首页和统计。当前 {demoCount} 条。</p>
        <div className="action-grid">
          <button onClick={createDemoData}>生成示例数据</button>
          <button onClick={removeDemoData}>清除示例数据</button>
        </div>
      </article>

      <article className="panel danger-zone">
        <h2>清空数据</h2>
        <p className="muted">执行前先导出备份。</p>
        <button className="danger-button" onClick={clearData}>清空全部数据</button>
      </article>
    </section>
  );
}

function MistakeImageView({ image }: { image?: MistakeImage }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!image) {
      setUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(image.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [image]);

  if (!image) return <div className="image-placeholder">暂无题目图片</div>;
  return <img className="mistake-image" src={url} alt="题目图片" />;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

export default App;
