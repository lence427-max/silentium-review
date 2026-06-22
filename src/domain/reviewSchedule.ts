import type { Mistake, ReviewAction, ReviewRecord } from '../types';
import { REVIEW_INTERVALS } from './constants';
import { addDays, toIsoDateTimeAtLocalStart } from './date';

export function calculateInitialReviewDate(createdAt: string): string {
  return toIsoDateTimeAtLocalStart(addDays(createdAt, 1));
}

export function applyReviewAction(
  mistake: Mistake,
  action: ReviewAction,
  reviewedAt: string
): { nextMistake: Mistake; record: ReviewRecord } {
  const updatedAt = new Date(reviewedAt).toISOString();
  let nextReviewAt: string | null = mistake.nextReviewAt;
  let reviewStage = mistake.reviewStage;
  let masteryStatus = mistake.masteryStatus;
  let isKeyMistake = mistake.isKeyMistake;

  if (action === 'mastered') {
    reviewStage += 1;
    if (reviewStage >= REVIEW_INTERVALS.length) {
      nextReviewAt = null;
      masteryStatus = 'mastered';
    } else {
      nextReviewAt = toIsoDateTimeAtLocalStart(addDays(reviewedAt, REVIEW_INTERVALS[reviewStage]));
      masteryStatus = 'reviewing';
    }
  }

  if (action === 'still_unknown') {
    nextReviewAt = toIsoDateTimeAtLocalStart(addDays(reviewedAt, 2));
    masteryStatus = 'reviewing';
  }

  if (action === 'third_round') {
    nextReviewAt = toIsoDateTimeAtLocalStart(addDays(reviewedAt, 2));
    masteryStatus = 'reviewing';
    isKeyMistake = true;
  }

  if (action === 'skipped') {
    nextReviewAt = toIsoDateTimeAtLocalStart(addDays(reviewedAt, 1));
  }

  const nextMistake: Mistake = {
    ...mistake,
    reviewStage,
    nextReviewAt,
    masteryStatus,
    isKeyMistake,
    updatedAt
  };

  return {
    nextMistake,
    record: {
      id: crypto.randomUUID(),
      mistakeId: mistake.id,
      action,
      reviewedAt: updatedAt,
      previousNextReviewAt: mistake.nextReviewAt,
      nextReviewAt
    }
  };
}
