"use server";

import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { generationTask, creditsBalance } from "@/db/schema";
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
