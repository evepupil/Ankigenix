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
 * 生成费 (Creation) - Phase B
 *
 * 用户选择章节生成卡片时按选中章节的 Input Tokens 扣费
 * 知识产出溢价
 */
export const CREATION_RATE_PER_10K_TOKENS = 2.0;

// ============================================
// 简单来源的固定积分消耗（旧版/小文件流程）
// ============================================

/**
 * 按输入类型的固定积分消耗
 */
export const CREDIT_COSTS_BY_SOURCE = {
  text: 1,
  url: 3,
  file: 3,
  video: 5,
} as const;

// ============================================
// 通用规则
// ============================================

/**
 * 单次操作最低消耗积分
 */
export const MIN_CREDITS_COST = 0.01;

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
 * 计算生成费（Phase B）
 *
 * @param selectedTokens - 选中章节的 Input Tokens
 * @returns 积分消耗量（两位小数，最低 MIN_CREDITS_COST）
 */
export function calculateCreationCost(selectedTokens: number): number {
  const cost = (selectedTokens / 10000) * CREATION_RATE_PER_10K_TOKENS;
  return Math.max(MIN_CREDITS_COST, truncateToTwoDecimals(cost));
}
