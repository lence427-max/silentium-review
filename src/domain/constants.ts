import type { QuestionType, Result, Subject } from '../types';

export const SUBJECT_LABELS: Record<Subject, string> = {
  math: '数学',
  english: '英语',
  major: '专业课',
  politics: '政治'
};

export const SUBJECT_MODULES: Record<Subject, string[]> = {
  math: ['高数', '线代', '概率'],
  english: ['阅读', '翻译', '作文', '完形', '新题型', '单词'],
  major: ['通用'],
  politics: ['选择题', '主观题', '知识点']
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: '选择',
  blank: '填空',
  essay: '大题',
  reading: '阅读题',
  calculation: '计算题',
  proof: '证明题'
};

export const RESULT_LABELS: Record<Result, string> = {
  wrong: '做错',
  partial: '半对',
  unknown: '不会',
  mastered: '已掌握'
};

export const ERROR_REASONS = [
  '概念不会',
  '公式忘了',
  '计算错误',
  '审题错误',
  '方法选错',
  '时间不够',
  '步骤不规范',
  '粗心',
  '看懂答案但自己不会做'
];

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
