import type { BackupPayload, Mistake, MistakeImage, ReviewRecord, Settings, StudyLog } from '../types';
import { blobToDataUrl, dataUrlToBlob } from '../domain/backup';
import { calculateInitialReviewDate } from '../domain/reviewSchedule';
import { toDateKey } from '../domain/date';
import { getDb } from './db';

const DEMO_MISTAKES: Array<Pick<Mistake, 'id' | 'subject' | 'module' | 'questionType' | 'result' | 'reason' | 'reflection' | 'note'>> = [
  {
    id: 'demo-math-integral-calculation',
    subject: 'math',
    module: '高数',
    questionType: 'calculation',
    result: 'wrong',
    reason: '计算错误',
    reflection: '积分换元后先检查上下限。',
    note: '示例数据：数学 / 高数 / 积分。'
  },
  {
    id: 'demo-math-linear-eigenvalue',
    subject: 'math',
    module: '线代',
    questionType: 'calculation',
    result: 'partial',
    reason: '方法选错',
    reflection: '先判断矩阵结构，再选特征值方法。',
    note: '示例数据：数学 / 线代 / 特征值。'
  },
  {
    id: 'demo-english-reading-location',
    subject: 'english',
    module: '阅读',
    questionType: 'reading',
    result: 'wrong',
    reason: '审题错误',
    reflection: '回原文定位，不凭印象选。',
    note: '示例数据：英语 / 阅读 / 定位。'
  },
  {
    id: 'demo-major-concept',
    subject: 'major',
    module: '通用',
    questionType: 'essay',
    result: 'unknown',
    reason: '概念不会',
    reflection: '用一句话写清概念边界。',
    note: '示例数据：专业课 / 通用 / 概念。'
  }
];

export async function getAllData() {
  const db = await getDb();
  const [mistakes, images, reviewRecords, studyLogs, settings] = await Promise.all([
    db.getAll('mistakes'),
    db.getAll('images'),
    db.getAll('reviewRecords'),
    db.getAll('studyLogs'),
    db.get('settings', 'default')
  ]);
  return { mistakes, images, reviewRecords, studyLogs, settings: settings ?? null };
}

export async function saveMistake(mistake: Mistake, image?: MistakeImage) {
  const db = await getDb();
  const tx = db.transaction(['mistakes', 'images'], 'readwrite');
  if (image) await tx.objectStore('images').put(image);
  await tx.objectStore('mistakes').put(mistake);
  await tx.done;
}

export async function updateMistakeWithReview(mistake: Mistake, record: ReviewRecord) {
  const db = await getDb();
  const tx = db.transaction(['mistakes', 'reviewRecords'], 'readwrite');
  await tx.objectStore('mistakes').put(mistake);
  await tx.objectStore('reviewRecords').put(record);
  await tx.done;
}

export async function updateMistakeAiSuggestion(
  id: string,
  suggestion: { summary: string; advice: string; tags: string[]; generatedAt: string }
) {
  const db = await getDb();
  const mistake = await db.get('mistakes', id);
  if (!mistake) throw new Error('错题不存在');
  await db.put('mistakes', {
    ...mistake,
    aiSummary: suggestion.summary,
    aiAdvice: suggestion.advice,
    aiTags: suggestion.tags,
    aiGeneratedAt: suggestion.generatedAt,
    updatedAt: suggestion.generatedAt
  });
}

export async function deleteMistake(id: string) {
  const db = await getDb();
  const mistake = await db.get('mistakes', id);
  const tx = db.transaction(['mistakes', 'images', 'reviewRecords'], 'readwrite');
  await tx.objectStore('mistakes').delete(id);
  if (mistake?.questionImageId) await tx.objectStore('images').delete(mistake.questionImageId);
  const records = await tx.objectStore('reviewRecords').index('mistakeId').getAll(id);
  await Promise.all(records.map((record) => tx.objectStore('reviewRecords').delete(record.id)));
  await tx.done;
}

export async function saveStudyLog(log: StudyLog) {
  const db = await getDb();
  await db.put('studyLogs', log);
}

export async function generateDemoData(nowInput = new Date().toISOString()) {
  const db = await getDb();
  const tx = db.transaction(['mistakes', 'studyLogs'], 'readwrite');
  const now = new Date(nowInput);

  await Promise.all(
    DEMO_MISTAKES.map(async (demo, index) => {
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - index);
      const createdAtIso = createdAt.toISOString();
      const nextReviewAt = index === 0 ? createdAtIso : calculateInitialReviewDate(createdAtIso);
      const mistake: Mistake = {
        ...demo,
        createdAt: createdAtIso,
        updatedAt: nowInput,
        reviewStage: index,
        nextReviewAt,
        masteryStatus: 'reviewing',
        isKeyMistake: false,
        isDemo: true
      };
      const log: StudyLog = {
        id: `demo-log-${demo.id}`,
        date: toDateKey(createdAtIso),
        subject: demo.subject,
        totalCount: 8 + index * 2,
        wrongCount: 1,
        createdAt: createdAtIso,
        updatedAt: nowInput,
        isDemo: true
      };

      await tx.objectStore('mistakes').put(mistake);
      await tx.objectStore('studyLogs').put(log);
    })
  );

  await tx.done;
}

export async function clearDemoData() {
  const db = await getDb();
  const [mistakes, images, reviewRecords, studyLogs] = await Promise.all([
    db.getAll('mistakes'),
    db.getAll('images'),
    db.getAll('reviewRecords'),
    db.getAll('studyLogs')
  ]);
  const demoMistakes = mistakes.filter((mistake) => mistake.isDemo);
  const demoMistakeIds = new Set(demoMistakes.map((mistake) => mistake.id));
  const demoImageIds = new Set(demoMistakes.map((mistake) => mistake.questionImageId).filter(Boolean));
  const tx = db.transaction(['mistakes', 'images', 'reviewRecords', 'studyLogs'], 'readwrite');

  await Promise.all([
    ...demoMistakes.map((mistake) => tx.objectStore('mistakes').delete(mistake.id)),
    ...images.filter((image) => demoImageIds.has(image.id)).map((image) => tx.objectStore('images').delete(image.id)),
    ...reviewRecords.filter((record) => demoMistakeIds.has(record.mistakeId)).map((record) => tx.objectStore('reviewRecords').delete(record.id)),
    ...studyLogs.filter((log) => log.isDemo).map((log) => tx.objectStore('studyLogs').delete(log.id))
  ]);

  await tx.done;
}

export async function saveSettings(settings: Settings) {
  const db = await getDb();
  await db.put('settings', settings);
}

export async function saveDeepSeekApiKey(apiKey: string) {
  const db = await getDb();
  const existing = await db.get('settings', 'default');
  const now = new Date().toISOString();
  await db.put('settings', {
    id: 'default',
    dailyGoal: existing?.dailyGoal ?? 20,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deepSeekApiKey: apiKey.trim(),
    deepSeekModel: existing?.deepSeekModel
  });
}

export async function saveDeepSeekModel(model: string) {
  const db = await getDb();
  const existing = await db.get('settings', 'default');
  const now = new Date().toISOString();
  await db.put('settings', {
    id: 'default',
    dailyGoal: existing?.dailyGoal ?? 20,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deepSeekApiKey: existing?.deepSeekApiKey,
    deepSeekModel: model.trim()
  });
}

export async function clearDeepSeekApiKey() {
  const db = await getDb();
  const existing = await db.get('settings', 'default');
  if (!existing) return;
  await db.put('settings', {
    ...withoutDeepSeekApiKey(existing),
    updatedAt: new Date().toISOString()
  });
}

function withoutDeepSeekApiKey(settings: Settings): Settings {
  const safeSettings = { ...settings };
  delete safeSettings.deepSeekApiKey;
  return safeSettings;
}

export async function exportBackup(): Promise<BackupPayload> {
  const data = await getAllData();
  const images = await Promise.all(
    data.images.map(async ({ blob, ...image }) => ({
      ...image,
      dataUrl: await blobToDataUrl(blob)
    }))
  );
  return {
    app: 'silentium-review',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      mistakes: data.mistakes,
      images,
      reviewRecords: data.reviewRecords,
      studyLogs: data.studyLogs,
      settings: data.settings ? withoutDeepSeekApiKey(data.settings) : null
    }
  };
}

export async function importBackup(payload: BackupPayload, clearFirst: boolean) {
  const db = await getDb();
  const tx = db.transaction(['mistakes', 'images', 'reviewRecords', 'studyLogs', 'settings'], 'readwrite');
  if (clearFirst) {
    await Promise.all([
      tx.objectStore('mistakes').clear(),
      tx.objectStore('images').clear(),
      tx.objectStore('reviewRecords').clear(),
      tx.objectStore('studyLogs').clear(),
      tx.objectStore('settings').clear()
    ]);
  }

  await Promise.all(payload.data.mistakes.map((mistake) => tx.objectStore('mistakes').put(mistake)));
  await Promise.all(
    payload.data.images.map(async (image) => {
      const blob = await dataUrlToBlob(image.dataUrl);
      await tx.objectStore('images').put({ ...image, blob });
    })
  );
  await Promise.all(payload.data.reviewRecords.map((record) => tx.objectStore('reviewRecords').put(record)));
  await Promise.all(payload.data.studyLogs.map((log) => tx.objectStore('studyLogs').put(log)));
  if (payload.data.settings) await tx.objectStore('settings').put(withoutDeepSeekApiKey(payload.data.settings));
  await tx.done;
}

export async function clearAllData() {
  const db = await getDb();
  const tx = db.transaction(['mistakes', 'images', 'reviewRecords', 'studyLogs', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('mistakes').clear(),
    tx.objectStore('images').clear(),
    tx.objectStore('reviewRecords').clear(),
    tx.objectStore('studyLogs').clear(),
    tx.objectStore('settings').clear()
  ]);
  await tx.done;
}
