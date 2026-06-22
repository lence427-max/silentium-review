import type { Mistake } from '../types';

export type AiReviewSuggestion = {
  summary: string;
  advice: string;
  tags: string[];
};

export type DeepSeekRequestOptions = {
  apiKey: string;
  model?: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';

function normalizeOptions(input: string | DeepSeekRequestOptions): Required<DeepSeekRequestOptions> {
  if (typeof input === 'string') {
    return { apiKey: input.trim(), model: DEFAULT_DEEPSEEK_MODEL };
  }
  return {
    apiKey: input.apiKey.trim(),
    model: input.model?.trim() || DEFAULT_DEEPSEEK_MODEL
  };
}

function buildMistakeTextPayload(mistake: Mistake) {
  return {
    subject: mistake.subject,
    module: mistake.module,
    questionType: mistake.questionType,
    result: mistake.result,
    reasons: mistake.reason,
    reason: mistake.reason,
    reflection: mistake.reflection,
    note: mistake.note ?? '',
    solutionText: mistake.solutionText ?? ''
  };
}

function extractJsonText(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }
  return content.trim();
}

function parseSuggestionContent(content: string): AiReviewSuggestion {
  try {
    const parsed: unknown = JSON.parse(extractJsonText(content));
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('invalid');
    }
    const suggestion = parsed as Partial<AiReviewSuggestion>;
    if (typeof suggestion.summary !== 'string' || typeof suggestion.advice !== 'string' || !Array.isArray(suggestion.tags)) {
      throw new Error('invalid');
    }
    return {
      summary: suggestion.summary.trim(),
      advice: suggestion.advice.trim(),
      tags: suggestion.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 5)
    };
  } catch {
    throw new Error('AI 返回格式不稳定，请稍后重新生成');
  }
}

async function readErrorReason(response: Response) {
  try {
    const data = await response.json();
    const message = data?.error?.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    // Ignore malformed error bodies and fall back to status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function postDeepSeek(options: Required<DeepSeekRequestOptions>, messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens = 360) {
  if (!options.apiKey) {
    throw new Error('请先在设置中填写 DeepSeek API Key');
  }

  const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      response_format: { type: 'json_object' },
      messages,
      temperature: 0.2,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    throw new Error(`AI 请求失败：${await readErrorReason(response)}`);
  }

  const data = (await response.json()) as DeepSeekResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 没有返回可用建议');
  }
  return content;
}

export async function generateAiReviewSuggestion(mistake: Mistake, input: string | DeepSeekRequestOptions): Promise<AiReviewSuggestion> {
  const options = normalizeOptions(input);

  try {
    const content = await postDeepSeek(options, [
      {
        role: 'system',
        content:
          '你是考研刷题复盘助手。只根据用户提供的文字字段生成复盘建议，不要假设图片内容。输出必须是 JSON，不要输出解释。风格：简洁、具体、不鸡汤、不说废话、不超过 120 字、重点回答下次怎么避免再错。'
      },
      {
        role: 'user',
        content: `根据这道错题生成 JSON，格式必须为 {"summary":"一句话说明主要错因","advice":"下次遇到类似题目的具体做法","tags":["标签1","标签2","标签3"]}。\n\n错题文字字段：${JSON.stringify(
          buildMistakeTextPayload(mistake)
        )}`
      }
    ]);
    return parseSuggestionContent(content);
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('请先') || error.message.startsWith('AI '))) {
      throw error;
    }
    throw new Error('AI 请求失败，请检查网络或 API Key 后重试');
  }
}

export async function testDeepSeekConnection(input: DeepSeekRequestOptions): Promise<{ ok: true }> {
  const options = normalizeOptions(input);
  try {
    await postDeepSeek(
      options,
      [
        {
          role: 'system',
          content: '只返回 JSON。'
        },
        {
          role: 'user',
          content: '请返回 {"ok": true} 用于连接测试。'
        }
      ],
      32
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('请先') || error.message.startsWith('AI '))) {
      throw error;
    }
    throw new Error('连接测试失败，请检查网络或 API Key');
  }
}
