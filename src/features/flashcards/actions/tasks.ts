"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deck, generationTask } from "@/db/schema";
import type { DocumentOutline } from "@/lib/ai/outline";
import { protectedAction } from "@/lib/safe-action";

/**
 * 任务状态类型（含大文件优化新状态）
 */
export type TaskStatus =
  | "pending"
  | "analyzing"
  | "outline_ready"
  | "processing"
  | "generating"
  | "completed"
  | "failed";

/**
 * 任务列表项类型
 */
export interface TaskListItem {
  id: string;
  status: TaskStatus;
  sourceType: "text" | "file" | "url" | "video";
  sourceFilename: string | null;
  cardCount: number;
  /** 索引费（Phase A - 文档分析） */
  indexingCost: number | null;
  /** 生成费（Phase B - 闪卡生成）或旧版固定费用 */
  creditsCost: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  // 大文件优化字段
  documentOutline: DocumentOutline | null;
  totalChunks: number | null;
  completedChunks: number | null;
  deck: {
    id: string;
    title: string;
  } | null;
}

/**
 * 获取用户所有任务列表
 *
 * 返回用户的所有闪卡生成任务，按创建时间倒序排列
 */
export const getUserTasksAction = protectedAction.action(
  async ({ ctx }): Promise<TaskListItem[]> => {
    const userId = ctx.user.id;

    // 查询用户所有任务
    const tasks = await db.query.generationTask.findMany({
      where: eq(generationTask.userId, userId),
      orderBy: [desc(generationTask.createdAt)],
    });

    // 获取关联的牌组信息
    const deckIds = tasks
      .map((t) => t.deckId)
      .filter((id): id is string => id !== null);

    const decks =
      deckIds.length > 0
        ? await db.query.deck.findMany({
            where: inArray(deck.id, deckIds),
          })
        : [];

    const deckMap = new Map(decks.map((d) => [d.id, d]));

    // 组装返回数据
    return tasks.map((task) => ({
      id: task.id,
      status: task.status as TaskListItem["status"],
      sourceType: task.sourceType as TaskListItem["sourceType"],
      sourceFilename: task.sourceFilename,
      cardCount: task.cardCount,
      indexingCost: task.indexingCost,
      creditsCost: task.creditsCost,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      documentOutline: task.documentOutline as DocumentOutline | null,
      totalChunks: task.totalChunks,
      completedChunks: task.completedChunks,
      deck: task.deckId
        ? {
            id: task.deckId,
            title: deckMap.get(task.deckId)?.title ?? "Untitled Deck",
          }
        : null,
    }));
  }
);

/**
 * 获取用户活跃任务数量
 *
 * 返回 pending/analyzing/outline_ready/processing/generating 状态的任务数量
 * 用于侧边栏徽章显示
 */
export const getActiveTaskCountAction = protectedAction.action(
  async ({ ctx }): Promise<{ count: number }> => {
    const userId = ctx.user.id;

    const activeTasks = await db.query.generationTask.findMany({
      where: and(
        eq(generationTask.userId, userId),
        inArray(generationTask.status, [
          "pending",
          "analyzing",
          "outline_ready",
          "processing",
          "generating",
        ])
      ),
      columns: { id: true },
    });

    return { count: activeTasks.length };
  }
);
