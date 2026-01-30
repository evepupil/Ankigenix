"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { creditsBalance, generationTask } from "@/db/schema";
import { inngest } from "@/inngest";
import { protectedAction } from "@/lib/safe-action";

/**
 * 积分消耗规则
 */
const CREDIT_COSTS = {
  text: 1,
  url: 3,
  file: 3,
  video: 5,
} as const;

/**
 * 字符限制规则
 */
const CHARACTER_LIMITS = {
  free: 1000,
  pro: 10000,
} as const;

/**
 * 生成闪卡 Schema
 */
const generateFlashcardsSchema = z.object({
  sourceType: z.enum(["text", "url", "file", "video"]),
  content: z.string().optional(),
  url: z.string().url().optional(),
  /** 文件名（文件上传时必填，用于确定解析器类型） */
  filename: z.string().optional(),
});

/**
 * 从文本生成闪卡 Server Action
 *
 * 创建异步任务并触发 Inngest 处理
 */
export const generateFlashcardsAction = protectedAction
  .schema(generateFlashcardsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { sourceType, content, url, filename } = parsedInput;
    const userId = ctx.user.id;

    // 验证输入
    if (sourceType === "text" && !content) {
      throw new Error("Content is required for text input");
    }

    if ((sourceType === "url" || sourceType === "video") && !url) {
      throw new Error("URL is required for URL/video input");
    }

    if (sourceType === "file" && (!url || !filename)) {
      throw new Error("File URL and filename are required for file input");
    }

    // 检查文本长度限制（简化版，假设都是免费用户）
    if (sourceType === "text" && content) {
      const limit = CHARACTER_LIMITS.free;
      if (content.length > limit) {
        throw new Error(
          `Text exceeds ${limit} character limit. Upgrade to Pro for up to ${CHARACTER_LIMITS.pro} characters.`
        );
      }
    }

    // 计算积分消耗
    const creditsCost = CREDIT_COSTS[sourceType];

    // 检查用户积分余额
    const balance = await db.query.creditsBalance.findFirst({
      where: eq(creditsBalance.userId, userId),
    });

    if (!balance || balance.balance < creditsCost) {
      throw new Error(
        `Insufficient credits. Required: ${creditsCost}, Available: ${balance?.balance ?? 0}`
      );
    }

    // 创建任务记录
    const taskId = nanoid();
    await db.insert(generationTask).values({
      id: taskId,
      userId,
      status: "pending",
      sourceType,
      sourceContent: sourceType === "text" ? content : null,
      sourceUrl: url || null,
      creditsCost,
    });

    // 触发 Inngest 后台任务
    await inngest.send({
      name: "flashcard/generate",
      data: {
        taskId,
        userId,
        sourceType,
        sourceContent: content,
        sourceUrl: url,
        sourceFilename: filename,
        creditsCost,
        userPlan: "free", // TODO: 从用户订阅信息获取
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      taskId,
      message: "Generation task created. Polling for status...",
    };
  });

/**
 * 快速文本生成 - 简化版 Action
 */
export const generateFromTextAction = protectedAction
  .schema(
    z.object({
      content: z.string().min(10, "Content must be at least 10 characters"),
    })
  )
  .action(async ({ parsedInput }) => {
    return generateFlashcardsAction({
      sourceType: "text",
      content: parsedInput.content,
    });
  });

// ============================================
// 大文件优化 - 两阶段生成流程
// ============================================

/**
 * 分析文档生成大纲 Schema（Phase A）
 */
const analyzeDocumentSchema = z.object({
  /** 文件在 R2/S3 的 URL */
  sourceUrl: z.string().url(),
  /** 原始文件名（用于确定解析器类型） */
  sourceFilename: z.string().min(1),
});

/**
 * 分析文档生成大纲（Phase A）
 *
 * 此阶段免费，不扣除积分
 * 流程：创建任务 → 触发 Inngest 分析 → 返回 taskId
 * 用户通过轮询获取大纲后选择章节
 */
export const analyzeDocumentAction = protectedAction
  .schema(analyzeDocumentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { sourceUrl, sourceFilename } = parsedInput;
    const userId = ctx.user.id;

    // 创建任务记录（Phase A 免费，creditsCost = 0）
    const taskId = nanoid();
    await db.insert(generationTask).values({
      id: taskId,
      userId,
      status: "pending",
      sourceType: "file",
      sourceUrl,
      sourceFilename,
      creditsCost: 0, // 分析阶段免费
    });

    // 触发 Inngest 分析任务
    await inngest.send({
      name: "flashcard/analyze-document",
      data: {
        taskId,
        userId,
        sourceUrl,
        sourceFilename,
        userPlan: "free", // TODO: 从用户订阅信息获取
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      taskId,
      message: "Document analysis started. Polling for outline...",
    };
  });

/**
 * 根据大纲选择生成闪卡 Schema（Phase B）
 */
const generateFromOutlineSchema = z.object({
  /** 已分析完成的任务 ID */
  taskId: z.string().min(1),
  /** 选定的章节索引数组 */
  selectedChapters: z.array(z.number().int().nonnegative()).min(1),
});

/**
 * 计算选定章节的积分消耗
 *
 * 规则：每 10k tokens 消耗 1 积分，最少 1 积分
 */
function calculateCreditsCost(selectedTokens: number): number {
  return Math.max(1, Math.ceil(selectedTokens / 10000));
}

/**
 * 根据大纲选择生成闪卡（Phase B）
 *
 * 流程：验证任务状态 → 计算积分 → 检查余额 → 触发生成
 */
export const generateFromOutlineAction = protectedAction
  .schema(generateFromOutlineSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { taskId, selectedChapters } = parsedInput;
    const userId = ctx.user.id;

    // 获取任务并验证
    const task = await db.query.generationTask.findFirst({
      where: eq(generationTask.id, taskId),
    });

    if (!task) {
      throw new Error("Task not found");
    }

    if (task.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (task.status !== "outline_ready") {
      throw new Error(
        `Invalid task status: ${task.status}. Expected: outline_ready`
      );
    }

    if (!task.documentOutline) {
      throw new Error("Document outline not found");
    }

    // 计算选定章节的 token 数
    const outline = task.documentOutline as {
      chapters: Array<{ index: number; estimatedTokens: number }>;
    };
    const selectedTokens = outline.chapters
      .filter((ch) => selectedChapters.includes(ch.index))
      .reduce((sum, ch) => sum + ch.estimatedTokens, 0);

    // 计算积分消耗
    const creditsCost = calculateCreditsCost(selectedTokens);

    // 检查用户积分余额
    const balance = await db.query.creditsBalance.findFirst({
      where: eq(creditsBalance.userId, userId),
    });

    if (!balance || balance.balance < creditsCost) {
      throw new Error(
        `Insufficient credits. Required: ${creditsCost}, Available: ${balance?.balance ?? 0}`
      );
    }

    // 更新任务的积分消耗
    await db
      .update(generationTask)
      .set({ creditsCost })
      .where(eq(generationTask.id, taskId));

    // 触发 Inngest 生成任务
    await inngest.send({
      name: "flashcard/generate-from-outline",
      data: {
        taskId,
        userId,
        selectedChapters,
        creditsCost,
        userPlan: "free", // TODO: 从用户订阅信息获取
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      taskId,
      creditsCost,
      selectedTokens,
      message: `Generating flashcards from ${selectedChapters.length} chapters...`,
    };
  });
