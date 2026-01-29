import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { deck, card } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * 导出牌组为 Anki .apkg 格式
 *
 * GET /api/export/apkg?deckId=xxx
 *
 * 使用 anki-apkg-export 库生成 .apkg 文件
 * 降级方案：生成 TSV 格式（Anki 也支持导入）
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
    const format = request.nextUrl.searchParams.get("format") || "apkg";

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

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "Deck has no cards to export" },
        { status: 400 }
      );
    }

    const safeName = deckData.title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
      .slice(0, 50);

    // 尝试生成 .apkg，降级为 TSV
    if (format === "apkg") {
      try {
        const apkgBuffer = await generateApkg(deckData.title, cards);
        return new NextResponse(new Uint8Array(apkgBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeName}.apkg"`,
          },
        });
      } catch {
        // apkg 生成失败，降级为 TSV
        console.warn("APKG generation failed, falling back to TSV");
      }
    }

    // TSV 格式（Anki 支持导入）
    const tsv = generateTsv(cards);
    return new NextResponse(tsv, {
      status: 200,
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.txt"`,
      },
    });
  } catch (error) {
    console.error("Error exporting:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}

/**
 * 生成 .apkg 文件
 */
async function generateApkg(
  deckTitle: string,
  cards: Array<{ front: string; back: string }>
): Promise<Buffer> {
  // 动态导入（CommonJS 模块）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnkiExport = require("anki-apkg-export").default;

  const apkg = AnkiExport(deckTitle);

  for (const c of cards) {
    apkg.addCard(c.front, c.back);
  }

  const zip = await apkg.save();

  // zip 可能是 ArrayBuffer 或 Buffer
  if (Buffer.isBuffer(zip)) {
    return zip;
  }

  return Buffer.from(zip);
}

/**
 * 生成 TSV 格式（Anki 可导入）
 *
 * 格式：front\tback\n
 * Anki 导入时选择 "Tab" 分隔符即可
 */
function generateTsv(
  cards: Array<{ front: string; back: string }>
): string {
  // 添加 Anki 导入提示标签
  let tsv = "#separator:tab\n";
  tsv += "#html:true\n";
  tsv += "#columns:Front\tBack\n";

  for (const c of cards) {
    // 转义制表符和换行符
    const front = c.front.replace(/\t/g, " ").replace(/\n/g, "<br>");
    const back = c.back.replace(/\t/g, " ").replace(/\n/g, "<br>");
    tsv += `${front}\t${back}\n`;
  }

  return tsv;
}
