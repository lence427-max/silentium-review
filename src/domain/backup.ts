import type { BackupPayload } from '../types';

export type ImportSummary = {
  mistakes: number;
  images: number;
  reviewRecords: number;
  studyLogs: number;
  hasSettings: boolean;
};

export function parseBackupPayload(text: string): BackupPayload {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式不正确');
  }
  const payload = parsed as Partial<BackupPayload>;
  if (payload.app !== 'silentium-review') {
    throw new Error('不是 Silentium Review 备份文件');
  }
  if (payload.version !== 1) {
    throw new Error('暂不支持该备份版本');
  }
  if (!payload.data || !Array.isArray(payload.data.mistakes)) {
    throw new Error('备份文件缺少错题数据');
  }
  return payload as BackupPayload;
}

export function createImportSummary(payload: Pick<BackupPayload, 'data'>): ImportSummary {
  return {
    mistakes: payload.data.mistakes.length,
    images: payload.data.images?.length ?? 0,
    reviewRecords: payload.data.reviewRecords?.length ?? 0,
    studyLogs: payload.data.studyLogs?.length ?? 0,
    hasSettings: Boolean(payload.data.settings)
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
