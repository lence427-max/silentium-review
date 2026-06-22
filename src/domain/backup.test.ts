import { describe, expect, it } from 'vitest';
import type { BackupPayload } from '../types';
import { createImportSummary, parseBackupPayload } from './backup';

describe('backup', () => {
  it('parses a valid Silentium Review backup payload', () => {
    const payload = {
      app: 'silentium-review',
      version: 1,
      exportedAt: '2026-06-20T12:00:00.000Z',
      data: {
        mistakes: [{ id: 'm1' }],
        images: [{ id: 'img1' }],
        reviewRecords: [],
        studyLogs: [{ id: 'l1' }],
        settings: null
      }
    } as BackupPayload;

    expect(parseBackupPayload(JSON.stringify(payload)).app).toBe('silentium-review');
    expect(createImportSummary(payload)).toEqual({
      mistakes: 1,
      images: 1,
      reviewRecords: 0,
      studyLogs: 1,
      hasSettings: false
    });
  });

  it('rejects backups from another app', () => {
    expect(() => parseBackupPayload(JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrow(
      '不是 Silentium Review 备份文件'
    );
  });
});
