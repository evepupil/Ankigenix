"use server";

import { nanoid } from "nanoid";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { deck, card } from "@/db/schema";
import { protectedAction } from "@/lib/safe-action";

// ============================================
// Deck CRUD Actions
// ============================================

/**
 * 获取用户的所有牌组
 */
export const getDecksAction = protectedAction
  .schema(z.object({}))
  .action(async ({ ctx }) => {
    const decks = await db.query.deck.findMany({
      where: eq(deck.userId, ctx.user.id),
      orderBy: [desc(deck.createdAt)],
    });

    return { decks };
  });

/**
 * 获取单个牌组详情（含卡片）
 */
export const getDeckAction = protectedAction
  .schema(z.object({ deckId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!deckData) {
      throw new Error("Deck not found");
    }

    const cards = await db.query.card.findMany({
      where: eq(card.deckId, parsedInput.deckId),
      orderBy: (card, { asc }) => [asc(card.sortIndex)],
    });

    return { deck: deckData, cards };
  });

/**
 * 创建新牌组
 */
export const createDeckAction = protectedAction
  .schema(
    z.object({
      title: z.string().min(1, "Title is required").max(100),
      description: z.string().max(500).optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const deckId = nanoid();

    await db.insert(deck).values({
      id: deckId,
      userId: ctx.user.id,
      title: parsedInput.title,
      description: parsedInput.description || null,
      sourceType: "text", // 手动创建的牌组默认为 text 类型
      cardCount: 0,
    });

    revalidatePath("/dashboard/decks");

    return { deckId };
  });

/**
 * 更新牌组信息
 */
export const updateDeckAction = protectedAction
  .schema(
    z.object({
      deckId: z.string(),
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    // 验证所有权
    const existing = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!existing) {
      throw new Error("Deck not found");
    }

    await db
      .update(deck)
      .set({
        ...(parsedInput.title && { title: parsedInput.title }),
        ...(parsedInput.description !== undefined && {
          description: parsedInput.description || null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(deck.id, parsedInput.deckId));

    revalidatePath("/dashboard/decks");

    return { success: true };
  });

/**
 * 删除牌组（级联删除所有卡片）
 */
export const deleteDeckAction = protectedAction
  .schema(z.object({ deckId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    // 验证所有权
    const existing = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!existing) {
      throw new Error("Deck not found");
    }

    // 删除牌组（卡片会级联删除）
    await db.delete(deck).where(eq(deck.id, parsedInput.deckId));

    revalidatePath("/dashboard/decks");

    return { success: true };
  });

// ============================================
// Card CRUD Actions
// ============================================

/**
 * 添加单张卡片到牌组
 */
export const addCardAction = protectedAction
  .schema(
    z.object({
      deckId: z.string(),
      front: z.string().min(1, "Front content is required"),
      back: z.string().min(1, "Back content is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    // 验证牌组所有权
    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!deckData) {
      throw new Error("Deck not found");
    }

    const cardId = nanoid();

    // 获取当前最大 sortIndex
    const lastCard = await db.query.card.findFirst({
      where: eq(card.deckId, parsedInput.deckId),
      orderBy: (card, { desc }) => [desc(card.sortIndex)],
    });

    const sortIndex = (lastCard?.sortIndex ?? -1) + 1;

    await db.insert(card).values({
      id: cardId,
      deckId: parsedInput.deckId,
      front: parsedInput.front,
      back: parsedInput.back,
      sortIndex,
    });

    // 更新牌组卡片数量
    await db
      .update(deck)
      .set({
        cardCount: deckData.cardCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(deck.id, parsedInput.deckId));

    revalidatePath(`/dashboard/decks/${parsedInput.deckId}`);

    return { cardId };
  });

/**
 * 更新卡片内容
 */
export const updateCardAction = protectedAction
  .schema(
    z.object({
      cardId: z.string(),
      front: z.string().min(1).optional(),
      back: z.string().min(1).optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    // 获取卡片和牌组验证所有权
    const cardData = await db.query.card.findFirst({
      where: eq(card.id, parsedInput.cardId),
    });

    if (!cardData) {
      throw new Error("Card not found");
    }

    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, cardData.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!deckData) {
      throw new Error("Unauthorized");
    }

    await db
      .update(card)
      .set({
        ...(parsedInput.front && { front: parsedInput.front }),
        ...(parsedInput.back && { back: parsedInput.back }),
        updatedAt: new Date(),
      })
      .where(eq(card.id, parsedInput.cardId));

    revalidatePath(`/dashboard/decks/${cardData.deckId}`);

    return { success: true };
  });

/**
 * 删除卡片
 */
export const deleteCardAction = protectedAction
  .schema(z.object({ cardId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    // 获取卡片和牌组验证所有权
    const cardData = await db.query.card.findFirst({
      where: eq(card.id, parsedInput.cardId),
    });

    if (!cardData) {
      throw new Error("Card not found");
    }

    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, cardData.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!deckData) {
      throw new Error("Unauthorized");
    }

    await db.delete(card).where(eq(card.id, parsedInput.cardId));

    // 更新牌组卡片数量
    await db
      .update(deck)
      .set({
        cardCount: Math.max(0, deckData.cardCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(deck.id, cardData.deckId));

    revalidatePath(`/dashboard/decks/${cardData.deckId}`);

    return { success: true };
  });

/**
 * 移动卡片到其他牌组
 */
export const moveCardAction = protectedAction
  .schema(
    z.object({
      cardId: z.string(),
      targetDeckId: z.string(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    // 获取卡片
    const cardData = await db.query.card.findFirst({
      where: eq(card.id, parsedInput.cardId),
    });

    if (!cardData) {
      throw new Error("Card not found");
    }

    // 验证原牌组所有权
    const sourceDeck = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, cardData.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!sourceDeck) {
      throw new Error("Unauthorized");
    }

    // 验证目标牌组所有权
    const targetDeck = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.targetDeckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!targetDeck) {
      throw new Error("Target deck not found");
    }

    // 获取目标牌组的最大 sortIndex
    const lastCard = await db.query.card.findFirst({
      where: eq(card.deckId, parsedInput.targetDeckId),
      orderBy: (card, { desc }) => [desc(card.sortIndex)],
    });

    const sortIndex = (lastCard?.sortIndex ?? -1) + 1;

    // 移动卡片
    await db
      .update(card)
      .set({
        deckId: parsedInput.targetDeckId,
        sortIndex,
        updatedAt: new Date(),
      })
      .where(eq(card.id, parsedInput.cardId));

    // 更新两个牌组的卡片数量
    await db
      .update(deck)
      .set({
        cardCount: Math.max(0, sourceDeck.cardCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(deck.id, cardData.deckId));

    await db
      .update(deck)
      .set({
        cardCount: targetDeck.cardCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(deck.id, parsedInput.targetDeckId));

    revalidatePath(`/dashboard/decks/${cardData.deckId}`);
    revalidatePath(`/dashboard/decks/${parsedInput.targetDeckId}`);

    return { success: true };
  });

/**
 * 批量添加卡片
 */
export const addCardsAction = protectedAction
  .schema(
    z.object({
      deckId: z.string(),
      cards: z.array(
        z.object({
          front: z.string().min(1),
          back: z.string().min(1),
        })
      ),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    // 验证牌组所有权
    const deckData = await db.query.deck.findFirst({
      where: and(
        eq(deck.id, parsedInput.deckId),
        eq(deck.userId, ctx.user.id)
      ),
    });

    if (!deckData) {
      throw new Error("Deck not found");
    }

    // 获取当前最大 sortIndex
    const lastCard = await db.query.card.findFirst({
      where: eq(card.deckId, parsedInput.deckId),
      orderBy: (card, { desc }) => [desc(card.sortIndex)],
    });

    let sortIndex = (lastCard?.sortIndex ?? -1) + 1;

    // 批量插入卡片
    const cardValues = parsedInput.cards.map((c) => ({
      id: nanoid(),
      deckId: parsedInput.deckId,
      front: c.front,
      back: c.back,
      sortIndex: sortIndex++,
    }));

    await db.insert(card).values(cardValues);

    // 更新牌组卡片数量
    await db
      .update(deck)
      .set({
        cardCount: deckData.cardCount + parsedInput.cards.length,
        updatedAt: new Date(),
      })
      .where(eq(deck.id, parsedInput.deckId));

    revalidatePath(`/dashboard/decks/${parsedInput.deckId}`);

    return { count: parsedInput.cards.length };
  });
