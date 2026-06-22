import { describe, expect, it } from 'vitest';
import type { Mistake } from '../types';
import { toDateKey } from './date';
import { applyReviewAction, calculateInitialReviewDate } from './reviewSchedule';

const baseMistake = (overrides: Partial<Mistake> = {}): Mistake => ({
  id: 'm1',
  subject: 'math',
  module: '高数',
  questionType: 'calculation',
  result: 'wrong',
  reason: '计算错误',
  reflection: '下次先检查符号和边界。',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  reviewStage: 0,
  nextReviewAt: '2026-06-02T00:00:00.000Z',
  masteryStatus: 'reviewing',
  isKeyMistake: false,
  ...overrides
});

describe('review schedule', () => {
  it('creates the first review one day after the mistake date', () => {
    expect(toDateKey(calculateInitialReviewDate('2026-06-01T10:00:00.000Z'))).toBe('2026-06-02');
  });

  it('moves mastered reviews through 1, 3, 7, 14, and 30 day intervals', () => {
    const reviewed = applyReviewAction(baseMistake({ reviewStage: 1 }), 'mastered', '2026-06-03T08:00:00.000Z');

    expect(reviewed.nextMistake.reviewStage).toBe(2);
    expect(toDateKey(reviewed.nextMistake.nextReviewAt!)).toBe('2026-06-10');
    expect(reviewed.nextMistake.masteryStatus).toBe('reviewing');
  });

  it('marks a mistake mastered after the final interval is completed', () => {
    const reviewed = applyReviewAction(baseMistake({ reviewStage: 4 }), 'mastered', '2026-07-02T08:00:00.000Z');

    expect(reviewed.nextMistake.reviewStage).toBe(5);
    expect(reviewed.nextMistake.nextReviewAt).toBeNull();
    expect(reviewed.nextMistake.masteryStatus).toBe('mastered');
  });

  it('keeps stage unchanged and delays two days when still unknown', () => {
    const reviewed = applyReviewAction(baseMistake({ reviewStage: 2 }), 'still_unknown', '2026-06-10T08:00:00.000Z');

    expect(reviewed.nextMistake.reviewStage).toBe(2);
    expect(toDateKey(reviewed.nextMistake.nextReviewAt!)).toBe('2026-06-12');
  });

  it('marks a key mistake and delays two days when third round is needed', () => {
    const reviewed = applyReviewAction(baseMistake(), 'third_round', '2026-06-02T08:00:00.000Z');

    expect(reviewed.nextMistake.isKeyMistake).toBe(true);
    expect(toDateKey(reviewed.nextMistake.nextReviewAt!)).toBe('2026-06-04');
  });

  it('delays one day when skipped', () => {
    const reviewed = applyReviewAction(baseMistake(), 'skipped', '2026-06-02T08:00:00.000Z');

    expect(toDateKey(reviewed.nextMistake.nextReviewAt!)).toBe('2026-06-03');
  });
});
