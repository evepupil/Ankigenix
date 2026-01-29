import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { deck, card } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * 导出牌组为 Markdown 格式
 *
 * GET /api/export/markdown?deckId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckId = request.nextUrl.searchParams.get("deckId");

    if (!deckId) {
      return NextResponse.json(
        { error: "deckId is required" },
        { status: 400 }
      );
    }

    // 获取牌组信息
    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, deckId),
        eq(deck.userId, session.user.id)
      ),
    });

    if (!deckData) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // 获取所有卡片
    const cards = await db.query.card.findMany({
      where: eq(card.deckId, deckId),
      orderBy: (card, { asc }) => [asc(card.sortIndex)],
    });

    // 生成 Markdown 内容
    let markdown = `# ${deckData.title}\n\n`;

    if (deckData.description) {
      markdown += `> ${deckData.description}\n\n`;
    }

    markdown += `**Cards:** ${cards.length}  \n`;
    markdown += `**Source:** ${deckData.sourceType}  \n`;
    markdown += `**Created:** ${deckData.createdAt.toISOString().split("T")[0]}\n\n`;
    markdown += `---\n\n`;

    cards.forEach((c, index) => {
      markdown += `## Card ${index + 1}\n\n`;
      markdown += `**Q:** ${c.front}\n\n`;
      markdown += `**A:** ${c.back}\n\n`;

      if (index < cards.length - 1) {
        markdown += `---\n\n`;
      }
    });

    // 生成安全的文件名
    const safeName = deckData.title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
      .slice(0, 50);

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.md"`,
      },
    });
  } catch (error) {
    console.error("Error exporting markdown:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
