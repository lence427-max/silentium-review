import type { Mistake, StudyLog, Subject } from '../types';
import { SUBJECT_LABELS } from './constants';
import { startOfWeekMonday, toStartOfLocalDay } from './date';

export type RankingItem = {
  label: string;
  count: number;
};

export type DashboardStats = {
  todayReviewCount: number;
  weeklyTotalCount: number;
  weeklyWrongCount: number;
  mostFrequentReason: RankingItem | null;
  weakestModule: RankingItem | null;
  nextAdvice: string;
  subjectWrongCounts: RankingItem[];
  reasonRanking: RankingItem[];
  moduleRanking: RankingItem[];
};

type StudyTipInput = Pick<DashboardStats, 'todayReviewCount' | 'mostFrequentReason' | 'weakestModule'>;

function rank(items: string[]): RankingItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
}

export function buildStats(mistakes: Mistake[], studyLogs: StudyLog[], nowInput = new Date().toISOString()): DashboardStats {
  const now = toStartOfLocalDay(nowInput);
  const weekStart = startOfWeekMonday(now);
  const weeklyLogs = studyLogs.filter((log) => {
    const date = toStartOfLocalDay(log.date);
    return date >= weekStart && date <= now;
  });
  const weeklyMistakes = mistakes.filter((mistake) => {
    const date = toStartOfLocalDay(mistake.createdAt);
    return date >= weekStart && date <= now;
  });
  const todayReviewCount = mistakes.filter((mistake) => {
    if (!mistake.nextReviewAt || mistake.masteryStatus === 'mastered') return false;
    return toStartOfLocalDay(mistake.nextReviewAt) <= now;
  }).length;

  const subjectWrongCounts = rank(weeklyMistakes.map((mistake) => SUBJECT_LABELS[mistake.subject as Subject]));
  const reasonRanking = rank(weeklyMistakes.map((mistake) => mistake.reason));
  const moduleRanking = rank(weeklyMistakes.map((mistake) => `${SUBJECT_LABELS[mistake.subject]} / ${mistake.module}`));
  const mostFrequentReason = reasonRanking[0] ?? null;
  const weakestModule = moduleRanking[0] ?? null;
  const nextAdvice =
    mostFrequentReason && weakestModule
      ? `优先复盘：${weakestModule.label}。`
      : '录入几题后生成建议。';

  return {
    todayReviewCount,
    weeklyTotalCount: weeklyLogs.reduce((sum, log) => sum + log.totalCount, 0),
    weeklyWrongCount: weeklyLogs.reduce((sum, log) => sum + log.wrongCount, 0),
    mostFrequentReason,
    weakestModule,
    nextAdvice,
    subjectWrongCounts,
    reasonRanking,
    moduleRanking
  };
}

export function buildStudyTips(stats: StudyTipInput): string[] {
  const tips: string[] = [];

  if (stats.todayReviewCount > 0) {
    tips.push('先完成今日复盘。');
  }
  if (stats.weakestModule) {
    tips.push(`优先复盘：${stats.weakestModule.label}。`);
  }
  if (stats.mostFrequentReason) {
    tips.push(`注意错因：${stats.mostFrequentReason.label}。`);
  }

  return tips.length > 0 ? tips : ['从一道错题开始。', '拍题，选错因。', '复盘是避免再错。'];
}
