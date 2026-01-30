import { encode, decode } from "gpt-tokenizer";

/**
 * Token 计数器
 *
 * 使用 GPT tokenizer 进行精确的 token 计数
 * 适用于 OpenAI GPT 系列模型
 */

/**
 * 计算文本的 token 数量
 *
 * @param text - 要计数的文本
 * @returns token 数量
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  return encode(text).length;
}

/**
 * 估算文本的 token 数量（快速但不精确）
 *
 * 适用于快速估算，避免大文本的 tokenize 开销
 * 规则：英文 ~4 字符/token，中文 ~2 字符/token
 *
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // 统计中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // 中文约 2 字符/token，其他约 4 字符/token
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 检查文本是否超过 token 限制
 *
 * @param text - 要检查的文本
 * @param limit - token 限制
 * @returns 是否超过限制
 */
export function exceedsTokenLimit(text: string, limit: number): boolean {
  return countTokens(text) > limit;
}

/**
 * 截断文本到指定 token 数量
 *
 * @param text - 要截断的文本
 * @param maxTokens - 最大 token 数量
 * @returns 截断后的文本
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const tokens = encode(text);
  if (tokens.length <= maxTokens) {
    return text;
  }
  return decode(tokens.slice(0, maxTokens));
}

/**
 * 获取文本的 token 信息
 *
 * @param text - 要分析的文本
 * @returns token 信息
 */
export function getTokenInfo(text: string): {
  tokenCount: number;
  estimatedCount: number;
  characterCount: number;
  wordCount: number;
} {
  const tokenCount = countTokens(text);
  const estimatedCount = estimateTokens(text);
  const characterCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    tokenCount,
    estimatedCount,
    characterCount,
    wordCount,
  };
}

/**
 * 模型 token 限制
 */
export const MODEL_TOKEN_LIMITS = {
  "gpt-4o-mini": 128000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
  "gpt-3.5-turbo": 16385,
  "deepseek-chat": 64000,
} as const;

/**
 * 获取模型的 token 限制
 */
export function getModelTokenLimit(
  model: keyof typeof MODEL_TOKEN_LIMITS
): number {
  return MODEL_TOKEN_LIMITS[model] ?? 128000;
}
