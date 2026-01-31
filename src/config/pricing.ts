/**
 * 积分计费价格配置
 *
 * 统一管理所有积分消耗的费率和规则
 * 修改此文件即可调整全局定价策略
 */

// ============================================
// 两阶段计费费率（大文件优化流程）
// ============================================

/**
 * 索引费 (Indexing) - Phase A
 *
 * 文件解析完成后按文档总 Input Tokens 扣费
 * 覆盖解析算力 + 大纲生成成本
 */
export const INDEXING_RATE_PER_10K_TOKENS = 1.2;

/**
 * 生成费 (Creation) - Phase B / Text Input
 *
 * 用户选择章节生成卡片时按选中章节的 Input Tokens 扣费
 * 也用于文本输入的按量计费
 */
export const CREATION_RATE_PER_10K_TOKENS = 2.0;

// ============================================
// 简单来源的固定积分消耗（旧版流程）
// ============================================

/**
 * 按输入类型的固定积分消耗（仅用于 URL/视频等非文本来源）
 */
export const CREDIT_COSTS_BY_SOURCE = {
  url: 3,
  video: 5,
} as const;

// ============================================
// 通用规则
// ============================================

/**
 * 单次操作最低消耗积分
 */
export const MIN_CREDITS_COST = 0.01;

/**
 * 文本输入最大字符数
 */
export const MAX_TEXT_CHARACTERS = 100000;

// ============================================
// 工具函数
// ============================================

/**
 * 截断到两位小数（直接抹零，不四舍五入）
 *
 * @param value - 原始数值
 * @returns 截断后的两位小数
 */
export function truncateToTwoDecimals(value: number): number {
  return Math.floor(value * 100) / 100;
}

/**
 * 估算文本的 token 数量（客户端友好，无需 tokenizer 库）
 *
 * 规则：英文 ~4 字符/token，中文 ~2 字符/token
 *
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokensFromText(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // 统计中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // 中文约 2 字符/token，其他约 4 字符/token
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

// ============================================
// 计算函数
// ============================================

/**
 * 计算索引费（Phase A）
 *
 * @param totalTokens - 文档总 Input Tokens
 * @returns 积分消耗量（两位小数，最低 MIN_CREDITS_COST）
 */
export function calculateIndexingCost(totalTokens: number): number {
  const cost = (totalTokens / 10000) * INDEXING_RATE_PER_10K_TOKENS;
  return Math.max(MIN_CREDITS_COST, truncateToTwoDecimals(cost));
}

/**
 * 计算生成费（Phase B / Text Input）
 *
 * @param selectedTokens - 选中章节的 Input Tokens 或文本 Tokens
 * @returns 积分消耗量（两位小数，最低 MIN_CREDITS_COST）
 */
export function calculateCreationCost(selectedTokens: number): number {
  const cost = (selectedTokens / 10000) * CREATION_RATE_PER_10K_TOKENS;
  return Math.max(MIN_CREDITS_COST, truncateToTwoDecimals(cost));
}

/**
 * 估算文本输入的积分消耗（客户端实时预估）
 *
 * @param text - 输入的文本
 * @returns 预估积分消耗（两位小数）
 */
export function estimateTextCredits(text: string): number {
  const estimatedTokens = estimateTokensFromText(text);
  return calculateCreationCost(estimatedTokens);
}
