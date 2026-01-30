import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { card, deck, generationTask } from "@/db/schema";

/**
 * 任务状态查询 API
 *
 * 用于前端轮询任务进度
 * GET /api/tasks/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 查询任务状态
    const task = await db.query.generationTask.findFirst({
      where: eq(generationTask.id, id),
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 如果任务完成，返回牌组和卡片信息
    let deckData = null;
    let cards: Array<{
      id: string;
      front: string;
      back: string;
      sortIndex: number;
    }> = [];

    if (task.status === "completed" && task.deckId) {
      deckData = await db.query.deck.findFirst({
        where: eq(deck.id, task.deckId),
      });

      const cardResults = await db.query.card.findMany({
        where: eq(card.deckId, task.deckId),
        orderBy: (card, { asc }) => [asc(card.sortIndex)],
      });

      cards = cardResults.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        sortIndex: c.sortIndex,
      }));
    }

    return NextResponse.json({
      id: task.id,
      status: task.status,
      sourceType: task.sourceType,
      sourceFilename: task.sourceFilename,
      cardCount: task.cardCount,
      creditsCost: task.creditsCost,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      // 大文件优化字段
      documentOutline: task.documentOutline,
      totalChunks: task.totalChunks,
      completedChunks: task.completedChunks,
      deck: deckData
        ? {
            id: deckData.id,
            title: deckData.title,
            description: deckData.description,
          }
        : null,
      cards,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
