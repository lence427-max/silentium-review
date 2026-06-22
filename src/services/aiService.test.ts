import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mistake } from '../types';
import { DEFAULT_DEEPSEEK_MODEL, generateAiReviewSuggestion, testDeepSeekConnection } from './aiService';

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
    expect(body.model).toBe(DEFAULT_DEEPSEEK_MODEL);
    const promptText = JSON.stringify(body.messages);
    expect(promptText).toContain('solutionText');
    expect(promptText).not.toContain('questionImageId');
    expect(promptText).not.toContain('blob');
  });

  it('uses a configured model name when requesting suggestions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"错因","advice":"建议","tags":["标签"]}' } }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateAiReviewSuggestion(mistake, { apiKey: 'test-api-key', model: 'deepseek-test-model' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('deepseek-test-model');
  });

  it('extracts JSON from a markdown code block response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n{"summary":"换元后上下限错误","advice":"先写变量范围再计算","tags":["积分","换元"]}\n```'
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiReviewSuggestion(mistake, 'test-api-key')).resolves.toEqual({
      summary: '换元后上下限错误',
      advice: '先写变量范围再计算',
      tags: ['积分', '换元']
    });
  });

  it('throws a friendly message for malformed AI JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这道题主要是计算错误，下次认真一点。' } }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiReviewSuggestion(mistake, 'test-api-key')).rejects.toThrow('AI 返回格式不稳定，请稍后重新生成');
  });

  it('includes a short HTTP error reason when DeepSeek rejects the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiReviewSuggestion(mistake, 'test-api-key')).rejects.toThrow('AI 请求失败：Invalid API key');
  });

  it('tests DeepSeek connectivity with the configured model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(testDeepSeekConnection({ apiKey: 'test-api-key', model: 'deepseek-test-model' })).resolves.toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('deepseek-test-model');
  });
});
