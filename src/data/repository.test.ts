import { beforeEach, describe, expect, it } from 'vitest';
import type { Mistake, StudyLog } from '../types';
import {
  clearAllData,
  clearDemoData,
  clearDeepSeekApiKey,
  exportBackup,
  generateDemoData,
  getAllData,
  saveDeepSeekApiKey,
  saveMistake,
  saveStudyLog,
  updateMistakeAiSuggestion
} from './repository';

const realMistake = (id: string): Mistake => ({
  id,
  subject: 'math',
  module: '高数',
  questionType: 'calculation',
  result: 'wrong',
  reason: '计算错误',
  reflection: '保留真实错题。',
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
  reviewStage: 0,
  nextReviewAt: '2026-06-21T10:00:00.000Z',
  masteryStatus: 'reviewing',
  isKeyMistake: false
});

const realLog = (id: string): StudyLog => ({
  id,
  date: '2026-06-20',
  subject: 'math',
  totalCount: 10,
  wrongCount: 1,
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z'
});

describe('repository demo data', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('generates marked demo data only once', async () => {
    await generateDemoData();
    await generateDemoData();

    const data = await getAllData();

    expect(data.mistakes).toHaveLength(4);
    expect(data.mistakes.every((mistake) => mistake.isDemo)).toBe(true);
    expect(data.studyLogs).toHaveLength(4);
    expect(data.studyLogs.every((log) => log.isDemo)).toBe(true);
  });

  it('clears only demo data and keeps user data', async () => {
    await saveMistake(realMistake('real-mistake'));
    await saveStudyLog(realLog('real-log'));
    await generateDemoData();

    await clearDemoData();

    const data = await getAllData();
    expect(data.mistakes.map((mistake) => mistake.id)).toEqual(['real-mistake']);
    expect(data.studyLogs.map((log) => log.id)).toEqual(['real-log']);
  });
});

describe('repository AI settings and suggestions', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('saves and clears the local DeepSeek API Key in settings', async () => {
    await saveDeepSeekApiKey('test-local-key');
    expect((await getAllData()).settings?.deepSeekApiKey).toBe('test-local-key');

    await clearDeepSeekApiKey();
    expect((await getAllData()).settings?.deepSeekApiKey).toBeUndefined();
  });

  it('does not include the DeepSeek API Key in JSON backups', async () => {
    await saveDeepSeekApiKey('test-local-key');

    const payload = await exportBackup();

    expect(payload.data.settings?.deepSeekApiKey).toBeUndefined();
  });

  it('updates only the AI suggestion fields on a mistake', async () => {
    await saveMistake(realMistake('ai-mistake'));

    await updateMistakeAiSuggestion('ai-mistake', {
      summary: '主要错在概念边界不清。',
      advice: '下次先写定义，再代入题干。',
      tags: ['概念', '定义'],
      generatedAt: '2026-06-22T12:00:00.000Z'
    });

    const mistake = (await getAllData()).mistakes[0];
    expect(mistake.aiSummary).toBe('主要错在概念边界不清。');
    expect(mistake.aiAdvice).toBe('下次先写定义，再代入题干。');
    expect(mistake.aiTags).toEqual(['概念', '定义']);
    expect(mistake.aiGeneratedAt).toBe('2026-06-22T12:00:00.000Z');
    expect(mistake.reflection).toBe('保留真实错题。');
  });
});
