import type { Mistake } from '../types';

export type AiReviewSuggestion = {
  summary: string;
  advice: string;
  tags: string[];
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-pro';

function buildMistakeTextPayload(mistake: Mistake) {
  return {
    subject: mistake.subject,
    module: mistake.module,
    questionType: mistake.questionType,
    result: mistake.result,
    reason: mistake.reason,
    reflection: mistake.reflection,
    note: mistake.note ?? '',
    solutionText: mistake.solutionText ?? ''
  };
}

function parseSuggestionContent(content: string): AiReviewSuggestion {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回格式不正确');
  }
  const suggestion = parsed as Partial<AiReviewSuggestion>;
  if (typeof suggestion.summary !== 'string' || typeof suggestion.advice !== 'string' || !Array.isArray(suggestion.tags)) {
    throw new Error('AI 返回格式不正确');
  }
  return {
    summary: suggestion.summary.trim(),
    advice: suggestion.advice.trim(),
    tags: suggestion.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 5)
  };
}

export async function generateAiReviewSuggestion(mistake: Mistake, apiKey: string): Promise<AiReviewSuggestion> {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error('请先在设置中填写 DeepSeek API Key');
  }

  try {
    const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedApiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是考研刷题复盘助手。请简洁、具体、不鸡汤、不长篇大论，只根据用户提供的文字字段生成复盘建议。不要假设图片内容。'
          },
          {
            role: 'user',
            content: `根据这道错题生成 JSON，格式必须为 {"summary":"一句话说明主要错因","advice":"下次遇到类似题目的具体做法","tags":["标签1","标签2","标签3"]}。\n\n错题文字字段：${JSON.stringify(
              buildMistakeTextPayload(mistake)
            )}`
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error('AI 请求失败，请稍后重试');
    }

    const data = (await response.json()) as DeepSeekResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 没有返回可用建议');
    }
    return parseSuggestionContent(content);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('请先')) {
      throw error;
    }
    if (error instanceof Error && (error.message === 'AI 返回格式不正确' || error.message.startsWith('AI '))) {
      throw error;
    }
    throw new Error('AI 请求失败，请检查网络或 API Key 后重试');
  }
}
