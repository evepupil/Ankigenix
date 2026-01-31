import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  card,
  creditsBalance,
  creditsTransaction,
  deck,
  generationTask,
} from "@/db/schema";
import { calculateIndexingCost } from "@/config/pricing";
import type { DocumentOutline } from "@/lib/ai/outline";
import {
  extractSelectedChaptersText,
  generateOutline,
} from "@/lib/ai/outline";
import { generateFlashcardsFromText } from "@/lib/ai/openai";
import { splitIntoChunks } from "@/lib/ai/chunking";
import { countTokens } from "@/lib/ai/tokenizer";
import { parseFileFromStorage } from "@/lib/parsers";
import { inngest } from "./client";

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
    const {
      taskId,
      userId,
      sourceType,
      sourceContent,
      sourceUrl,
      sourceFilename,
      fileKey,
      creditsCost,
    } = event.data;

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

        case "url": {
          // TODO: 实现 Jina Reader API 解析
          if (!sourceUrl) {
            throw new Error("No URL provided");
          }
          const jinaResponse = await fetch(`https://r.jina.ai/${sourceUrl}`);
          if (!jinaResponse.ok) {
            throw new Error(
              `Failed to fetch URL content: ${jinaResponse.statusText}`
            );
          }
          content = await jinaResponse.text();
          break;
        }

        case "file":
          if (!fileKey || !sourceFilename) {
            throw new Error(
              "File key and filename are required for file source"
            );
          }
          content = await parseFileFromStorage(
            fileKey,
            process.env.STORAGE_BUCKET_NAME || "ankigenix-uploads",
            sourceFilename
          );
          break;

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
            : sourceType === "file" && sourceFilename
              ? `File: ${sourceFilename}`
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
 * 分析文档生成大纲（大文件优化 Phase A）
 *
 * 流程：
 * 1. 下载并解析文件
 * 2. 计算 token 数
 * 3. 调用 LLM 生成文档大纲
 * 4. 保存大纲到数据库，状态更新为 outline_ready
 *
 * 此阶段免费，不扣除积分
 */
export const analyzeDocument = inngest.createFunction(
  {
    id: "analyze-document",
    concurrency: {
      limit: 20,
      key: "event.data.userPlan",
    },
    retries: 2,
  },
  { event: "flashcard/analyze-document" },
  async ({ event, step }) => {
    const { taskId, userId, sourceFilename, fileKey } = event.data;

    // Step 1: 更新任务状态为分析中
    await step.run("update-task-analyzing", async () => {
      await db
        .update(generationTask)
        .set({
          status: "analyzing",
          startedAt: new Date(),
        })
        .where(eq(generationTask.id, taskId));
    });

    // Step 2: 下载并解析文件
    const documentText = await step.run("download-and-parse", async () => {
      return await parseFileFromStorage(
        fileKey,
        process.env.STORAGE_BUCKET_NAME || "ankigenix-uploads",
        sourceFilename
      );
    });

    // Step 3: 计算 token 数
    const totalTokens = await step.run("count-tokens", async () => {
      return countTokens(documentText);
    });

    // Step 3.5: 扣除索引费（按文档总 Input Tokens 计算）
    const indexingCost = await step.run("deduct-indexing-credits", async () => {
      const cost = calculateIndexingCost(totalTokens);

      const balance = await db.query.creditsBalance.findFirst({
        where: eq(creditsBalance.userId, userId),
      });

      if (!balance || balance.balance < cost) {
        throw new Error(
          `Insufficient credits for indexing. Required: ${cost}, Available: ${balance?.balance ?? 0}`
        );
      }

      // 扣除积分
      await db
        .update(creditsBalance)
        .set({
          balance: balance.balance - cost,
          totalSpent: balance.totalSpent + cost,
          updatedAt: new Date(),
        })
        .where(eq(creditsBalance.userId, userId));

      // 记录交易
      await db.insert(creditsTransaction).values({
        id: nanoid(),
        userId,
        type: "consumption",
        amount: cost,
        debitAccount: "user_balance",
        creditAccount: "document_indexing",
        description: `Document indexing: ${sourceFilename} (${totalTokens} tokens)`,
        metadata: { taskId, sourceFilename, totalTokens },
      });

      // 更新任务的索引费
      await db
        .update(generationTask)
        .set({ creditsCost: cost })
        .where(eq(generationTask.id, taskId));

      return cost;
    });

    // Step 4: 生成文档大纲
    const outline = await step.run("generate-outline", async () => {
      return await generateOutline(documentText);
    });

    // Step 5: 保存大纲到数据库
    await step.run("save-outline", async () => {
      await db
        .update(generationTask)
        .set({
          status: "outline_ready",
          documentOutline: outline,
          documentText: documentText,
          sourceFilename: sourceFilename,
        })
        .where(eq(generationTask.id, taskId));
    });

    return {
      taskId,
      totalTokens,
      indexingCost,
      chapterCount: outline.chapters.length,
    };
  }
);

/**
 * 根据大纲选择生成闪卡（大文件优化 Phase B）
 *
 * 流程：
 * 1. 验证并扣除积分
 * 2. 从缓存的全文提取选定章节文本
 * 3. 分块处理（~3500 token/块）
 * 4. 并行调用 LLM 生成闪卡
 * 5. 合并去重并保存
 *
 * 积分消耗 = 根据选定章节 token 数计算
 */
export const generateFromOutline = inngest.createFunction(
  {
    id: "generate-from-outline",
    concurrency: {
      limit: 10,
      key: "event.data.userPlan",
    },
    retries: 2,
  },
  { event: "flashcard/generate-from-outline" },
  async ({ event, step }) => {
    const { taskId, userId, selectedChapters, creditsCost } = event.data;

    // Step 1: 获取任务并验证
    const task = await step.run("get-task", async () => {
      const t = await db.query.generationTask.findFirst({
        where: eq(generationTask.id, taskId),
      });
      if (!t) throw new Error("Task not found");
      if (t.status !== "outline_ready") {
        throw new Error(`Invalid task status: ${t.status}`);
      }
      if (!t.documentOutline || !t.documentText) {
        throw new Error("Missing document outline or text");
      }
      return t;
    });

    // Step 2: 更新任务状态为生成中
    await step.run("update-task-generating", async () => {
      await db
        .update(generationTask)
        .set({
          status: "generating",
          selectedChapters: selectedChapters,
        })
        .where(eq(generationTask.id, taskId));
    });

    // Step 3: 扣除积分
    await step.run("deduct-credits", async () => {
      const balance = await db.query.creditsBalance.findFirst({
        where: eq(creditsBalance.userId, userId),
      });

      if (!balance || balance.balance < creditsCost) {
        throw new Error("Insufficient credits");
      }

      await db
        .update(creditsBalance)
        .set({
          balance: balance.balance - creditsCost,
          totalSpent: balance.totalSpent + creditsCost,
          updatedAt: new Date(),
        })
        .where(eq(creditsBalance.userId, userId));

      await db.insert(creditsTransaction).values({
        id: nanoid(),
        userId,
        type: "consumption",
        amount: creditsCost,
        debitAccount: "user_balance",
        creditAccount: "flashcard_generation",
        description: `Flashcard generation from file (${selectedChapters.length} chapters)`,
        metadata: { taskId, selectedChapters },
      });
    });

    // Step 4: 提取选定章节文本并分块
    const chunks = await step.run("extract-and-chunk", async () => {
      const outline = task.documentOutline as DocumentOutline;
      const selectedText = extractSelectedChaptersText(
        task.documentText as string,
        outline,
        selectedChapters
      );

      const textChunks = splitIntoChunks(selectedText, {
        maxTokens: 3500,
        overlap: 200,
        strategy: "paragraph",
      });

      // 更新总分块数
      await db
        .update(generationTask)
        .set({
          totalChunks: textChunks.length,
          completedChunks: 0,
        })
        .where(eq(generationTask.id, taskId));

      return textChunks;
    });

    // Step 5: 并行生成每个分块的闪卡
    const allFlashcards = await step.run("generate-all-chunks", async () => {
      const results = await Promise.all(
        chunks.map(async (chunk, index) => {
          try {
            const cards = await generateFlashcardsFromText(chunk.text, 30);

            // 更新进度
            await db
              .update(generationTask)
              .set({
                completedChunks: index + 1,
              })
              .where(eq(generationTask.id, taskId));

            return cards;
          } catch (error) {
            console.error(`Error generating chunk ${index}:`, error);
            return [];
          }
        })
      );

      return results.flat();
    });

    // Step 6: 去重并保存
    const result = await step.run("save-to-database", async () => {
      // 简单去重：基于 front 内容
      const uniqueCards = new Map<
        string,
        { front: string; back: string }
      >();
      for (const card of allFlashcards) {
        const key = card.front.toLowerCase().trim();
        if (!uniqueCards.has(key)) {
          uniqueCards.set(key, card);
        }
      }
      const dedupedCards = Array.from(uniqueCards.values());

      // 创建牌组
      const deckId = nanoid();
      const outline = task.documentOutline as DocumentOutline;
      const selectedTitles = outline.chapters
        .filter((ch) => selectedChapters.includes(ch.index))
        .map((ch) => ch.title)
        .slice(0, 3)
        .join(", ");

      const deckTitle = task.sourceFilename
        ? `${task.sourceFilename} - ${selectedTitles}`
        : `Document - ${selectedTitles}`;

      await db.insert(deck).values({
        id: deckId,
        userId,
        title: deckTitle.slice(0, 100), // 限制标题长度
        sourceType: "file",
        sourceUrl: task.sourceUrl,
        cardCount: dedupedCards.length,
      });

      // 批量插入卡片
      const cardValues = dedupedCards.map((fc, index) => ({
        id: nanoid(),
        deckId,
        front: fc.front,
        back: fc.back,
        sortIndex: index,
      }));

      if (cardValues.length > 0) {
        await db.insert(card).values(cardValues);
      }

      // 更新任务状态为完成
      await db
        .update(generationTask)
        .set({
          status: "completed",
          deckId,
          cardCount: dedupedCards.length,
          completedAt: new Date(),
        })
        .where(eq(generationTask.id, taskId));

      return { deckId, cardCount: dedupedCards.length };
    });

    return result;
  }
);

/**
 * 导出所有 Inngest 函数
 */
export const functions = [
  generateFlashcards,
  analyzeDocument,
  generateFromOutline,
];
