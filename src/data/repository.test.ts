import { beforeEach, describe, expect, it } from 'vitest';
import type { Mistake, StudyLog } from '../types';
import { clearAllData, clearDemoData, generateDemoData, getAllData, saveMistake, saveStudyLog } from './repository';

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
