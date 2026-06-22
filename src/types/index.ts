export type Subject = 'math' | 'english' | 'major' | 'politics';

export type Result = 'wrong' | 'partial' | 'unknown' | 'mastered';

export type MasteryStatus = 'unmastered' | 'reviewing' | 'mastered';

export type ReviewAction = 'mastered' | 'still_unknown' | 'third_round' | 'skipped';

export type QuestionType = 'choice' | 'blank' | 'essay' | 'reading' | 'calculation' | 'proof';

export type MistakeImage = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  width?: number;
  height?: number;
  size: number;
  createdAt: string;
};

export type Mistake = {
  id: string;
  subject: Subject;
  module: string;
  questionType: QuestionType;
  result: Result;
  reason: string;
  reflection: string;
  note?: string;
  questionImageId?: string;
  createdAt: string;
  updatedAt: string;
  reviewStage: number;
  nextReviewAt: string | null;
  masteryStatus: MasteryStatus;
  isKeyMistake: boolean;
  isDemo?: boolean;
  aiSummary?: string;
  aiAdvice?: string;
  aiTags?: string[];
  aiGeneratedAt?: string;
};

export type ReviewRecord = {
  id: string;
  mistakeId: string;
  action: ReviewAction;
  reviewedAt: string;
  previousNextReviewAt: string | null;
  nextReviewAt: string | null;
};

export type StudyLog = {
  id: string;
  date: string;
  subject: Subject;
  totalCount: number;
  wrongCount: number;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
};

export type Settings = {
  id: 'default';
  dailyGoal: number;
  createdAt: string;
  updatedAt: string;
};

export type BackupPayload = {
  app: 'silentium-review';
  version: 1;
  exportedAt: string;
  data: {
    mistakes: Mistake[];
    images: SerializedImage[];
    reviewRecords: ReviewRecord[];
    studyLogs: StudyLog[];
    settings: Settings | null;
  };
};

export type SerializedImage = Omit<MistakeImage, 'blob'> & {
  dataUrl: string;
};
