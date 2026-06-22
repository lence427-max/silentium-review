import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mistake } from '../types';
import { generateAiReviewSuggestion } from './aiService';

const mistake: Mistake = {
  id: 'm1',
  subject: 'math',
  module: '高数',
  questionType: 'calculation',
  result: 'wrong',
  reason: '计算错误',
  reflection: '下次先检查换元上下限。',
  note: '积分题。',
  solutionText: '令 u = x + 1 后上下限也要同步变化。',
  createdAt: '2026-06-22T08:00:00.000Z',
  updatedAt: '2026-06-22T08:00:00.000Z',
  reviewStage: 0,
  nextReviewAt: '2026-06-23T08:00:00.000Z',
  masteryStatus: 'reviewing',
  isKeyMistake: false
};

describe('aiService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for a DeepSeek API Key before requesting a suggestion', async () => {
    await expect(generateAiReviewSuggestion(mistake, '')).rejects.toThrow('请先在设置中填写 DeepSeek API Key');
  });

  it('sends only text fields and parses JSON suggestions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: '主要错在换元后没有同步上下限。',
                advice: '下次换元后先写新变量范围，再继续计算。',
                tags: ['积分', '换元', '上下限']
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateAiReviewSuggestion(mistake, 'test-api-key');

    expect(result).toEqual({
      summary: '主要错在换元后没有同步上下限。',
      advice: '下次换元后先写新变量范围，再继续计算。',
      tags: ['积分', '换元', '上下限']
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key'
        })
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const promptText = JSON.stringify(body.messages);
    expect(promptText).toContain('solutionText');
    expect(promptText).not.toContain('questionImageId');
    expect(promptText).not.toContain('blob');
  });
});
