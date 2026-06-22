import { describe, expect, it } from 'vitest';
import type { Mistake, StudyLog } from '../types';
import { buildStats, buildStudyTips } from './statistics';

const mistake = (id: string, fields: Partial<Mistake>): Mistake => ({
  id,
  subject: 'math',
  module: '高数',
  questionType: 'calculation',
  result: 'wrong',
  reason: '计算错误',
  reflection: '下次要复查。',
  createdAt: '2026-06-16T10:00:00.000Z',
  updatedAt: '2026-06-16T10:00:00.000Z',
  reviewStage: 0,
  nextReviewAt: '2026-06-17T00:00:00.000Z',
  masteryStatus: 'reviewing',
  isKeyMistake: false,
  ...fields
});

const log = (id: string, fields: Partial<StudyLog>): StudyLog => ({
  id,
  date: '2026-06-16',
  subject: 'math',
  totalCount: 20,
  wrongCount: 3,
  createdAt: '2026-06-16T12:00:00.000Z',
  updatedAt: '2026-06-16T12:00:00.000Z',
  ...fields
});

describe('statistics', () => {
  it('summarizes the current week and ranks weak reasons and modules', () => {
    const stats = buildStats(
      [
        mistake('m1', { reason: '计算错误', module: '高数', subject: 'math' }),
        mistake('m2', { reason: '计算错误', module: '高数', subject: 'math' }),
        mistake('m3', { reason: '方法选错', module: '阅读', subject: 'english' }),
        mistake('old', { reason: '粗心', module: '概率', createdAt: '2026-06-01T10:00:00.000Z' })
      ],
      [
        log('l1', { date: '2026-06-16', totalCount: 20, wrongCount: 2 }),
        log('l2', { date: '2026-06-18', totalCount: 30, wrongCount: 3 }),
        log('old', { date: '2026-06-01', totalCount: 99, wrongCount: 9 })
      ],
      '2026-06-20T12:00:00.000Z'
    );

    expect(stats.weeklyTotalCount).toBe(50);
    expect(stats.weeklyWrongCount).toBe(5);
    expect(stats.subjectWrongCounts).toEqual([
      { label: '数学', count: 2 },
      { label: '英语', count: 1 }
    ]);
    expect(stats.reasonRanking[0]).toEqual({ label: '计算错误', count: 2 });
    expect(stats.moduleRanking[0]).toEqual({ label: '数学 / 高数', count: 2 });
    expect(stats.nextAdvice).toBe('优先复盘：数学 / 高数。');
  });

  it('gives a gentle empty-state advice when there is not enough data', () => {
    const stats = buildStats([], [], '2026-06-20T12:00:00.000Z');

    expect(stats.nextAdvice).toBe('录入几题后生成建议。');
  });

  it('builds rotating study tips from current stats', () => {
    const tips = buildStudyTips({
      todayReviewCount: 2,
      weakestModule: { label: '数学 / 高数', count: 2 },
      mostFrequentReason: { label: '计算错误', count: 2 }
    });

    expect(tips).toEqual(['先完成今日复盘。', '优先复盘：数学 / 高数。', '注意错因：计算错误。']);
  });

  it('uses starter tips when there is not enough data', () => {
    const tips = buildStudyTips({
      todayReviewCount: 0,
      weakestModule: null,
      mostFrequentReason: null
    });

    expect(tips).toEqual(['从一道错题开始。', '拍题，选错因。', '复盘是避免再错。']);
  });
});
