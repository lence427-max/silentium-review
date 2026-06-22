import { openDB, type DBSchema } from 'idb';
import type { Mistake, MistakeImage, ReviewRecord, Settings, StudyLog } from '../types';

export type SilentiumDb = DBSchema & {
  mistakes: {
    key: string;
    value: Mistake;
    indexes: {
      subject: string;
      module: string;
      reason: string;
      masteryStatus: string;
      nextReviewAt: string;
      createdAt: string;
    };
  };
  images: {
    key: string;
    value: MistakeImage;
  };
  reviewRecords: {
    key: string;
    value: ReviewRecord;
    indexes: {
      mistakeId: string;
      reviewedAt: string;
      action: string;
    };
  };
  studyLogs: {
    key: string;
    value: StudyLog;
    indexes: {
      date: string;
      subject: string;
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
};

export const DB_NAME = 'silentium-review-db';
export const DB_VERSION = 1;

export function getDb() {
  return openDB<SilentiumDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const mistakes = db.createObjectStore('mistakes', { keyPath: 'id' });
      mistakes.createIndex('subject', 'subject');
      mistakes.createIndex('module', 'module');
      mistakes.createIndex('reason', 'reason');
      mistakes.createIndex('masteryStatus', 'masteryStatus');
      mistakes.createIndex('nextReviewAt', 'nextReviewAt');
      mistakes.createIndex('createdAt', 'createdAt');

      db.createObjectStore('images', { keyPath: 'id' });

      const reviewRecords = db.createObjectStore('reviewRecords', { keyPath: 'id' });
      reviewRecords.createIndex('mistakeId', 'mistakeId');
      reviewRecords.createIndex('reviewedAt', 'reviewedAt');
      reviewRecords.createIndex('action', 'action');

      const studyLogs = db.createObjectStore('studyLogs', { keyPath: 'id' });
      studyLogs.createIndex('date', 'date');
      studyLogs.createIndex('subject', 'subject');

      db.createObjectStore('settings', { keyPath: 'id' });
    }
  });
}
