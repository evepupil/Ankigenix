import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { db } from "@/db";
import {
  generationTask,
  deck,
  card,
  creditsBalance,
  creditsTransaction,
} from "@/db/schema";
import { generateFlashcardsFromText } from "@/lib/ai/openai";

/**
 * 闪卡生成 Inngest 函数
 *
 * 处理异步闪卡生成任务：
 * 1. 验证并扣除积分
 * 2. 解析输入源（文本/URL/文件/视频）
 * 3. 调用 LLM 生成闪卡
 * 4. 保存结果到数据库
 */
export const generateFlashcards = inngest.createFunction(
  {
    id: "generate-flashcards",
    concurrency: {
      limit: 10,
      key: "event.data.userPlan",
    },
    retries: 2,
  },
  { event: "flashcard/generate" },
  async ({ event, step }) => {
    const { taskId, userId, sourceType, sourceContent, sourceUrl, creditsCost } =
      event.data;

    // Step 1: 更新任务状态为处理中
    await step.run("update-task-processing", async () => {
      await db
        .update(generationTask)
        .set({
          status: "processing",
          startedAt: new Date(),
        })
        .where(eq(generationTask.id, taskId));
    });

    // Step 2: 扣除积分
    await step.run("deduct-credits", async () => {
      // 获取用户积分余额
      const balance = await db.query.creditsBalance.findFirst({
        where: eq(creditsBalance.userId, userId),
      });

      if (!balance || balance.balance < creditsCost) {
        throw new Error("Insufficient credits");
      }

      // 扣除积分 - 使用简化逻辑（实际项目应使用 FIFO 批次扣除）
      await db
        .update(creditsBalance)
        .set({
          balance: balance.balance - creditsCost,
          totalSpent: balance.totalSpent + creditsCost,
          updatedAt: new Date(),
        })
        .where(eq(creditsBalance.userId, userId));

      // 记录交易
      await db.insert(creditsTransaction).values({
        id: nanoid(),
        userId,
        type: "consumption",
        amount: creditsCost,
        debitAccount: "user_balance",
        creditAccount: "flashcard_generation",
        description: `Flashcard generation from ${sourceType}`,
        metadata: { taskId, sourceType },
      });
    });

    // Step 3: 解析内容并生成闪卡
    const flashcards = await step.run("generate-cards", async () => {
      let content: string;

      switch (sourceType) {
        case "text":
          if (!sourceContent) {
            throw new Error("No content provided for text source");
          }
          content = sourceContent;
          break;

        case "url":
          // TODO: 实现 Jina Reader API 解析
          if (!sourceUrl) {
            throw new Error("No URL provided");
          }
          const jinaResponse = await fetch(`https://r.jina.ai/${sourceUrl}`);
          if (!jinaResponse.ok) {
            throw new Error(`Failed to fetch URL content: ${jinaResponse.statusText}`);
          }
          content = await jinaResponse.text();
          break;

        case "file":
          // TODO: 实现文件解析
          throw new Error("File parsing not yet implemented");

        case "video":
          // TODO: 实现视频字幕提取
          throw new Error("Video parsing not yet implemented");

        default:
          throw new Error(`Unsupported source type: ${sourceType}`);
      }

      // 调用 LLM 生成闪卡
      return await generateFlashcardsFromText(content);
    });

    // Step 4: 创建牌组并保存卡片
    const result = await step.run("save-to-database", async () => {
      // 创建牌组
      const deckId = nanoid();
      const deckTitle =
        sourceType === "text"
          ? `Text Flashcards - ${new Date().toLocaleDateString()}`
          : sourceType === "url"
            ? `URL: ${sourceUrl?.slice(0, 50)}...`
            : `${sourceType} Flashcards`;

      await db.insert(deck).values({
        id: deckId,
        userId,
        title: deckTitle,
        sourceType,
        sourceUrl: sourceUrl || null,
        cardCount: flashcards.length,
      });

      // 批量插入卡片
      const cardValues = flashcards.map((fc, index) => ({
        id: nanoid(),
        deckId,
        front: fc.front,
        back: fc.back,
        sortIndex: index,
      }));

      await db.insert(card).values(cardValues);

      // 更新任务状态为完成
      await db
        .update(generationTask)
        .set({
          status: "completed",
          deckId,
          cardCount: flashcards.length,
          completedAt: new Date(),
        })
        .where(eq(generationTask.id, taskId));

      return { deckId, cardCount: flashcards.length };
    });

    return result;
  }
);

/**
 * 导出所有 Inngest 函数
 */
export const functions = [generateFlashcards];
