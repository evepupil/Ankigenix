import OpenAI from "openai";

/**
 * OpenAI 客户端实例
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 闪卡结构
 */
export interface Flashcard {
  front: string;
  back: string;
}

/**
 * 生成闪卡的 System Prompt
 */
const FLASHCARD_SYSTEM_PROMPT = `You are an expert educator and flashcard creator. Your task is to generate high-quality flashcards from the provided content.

Rules:
1. Create clear, concise question-answer pairs
2. Each "front" should be a focused question or concept
3. Each "back" should be a clear, complete answer
4. Avoid overly simple or trivial cards
5. Focus on key concepts, definitions, and important facts
6. Use simple language that aids memorization
7. Generate between 5-20 cards depending on content length

Output ONLY a valid JSON array with no additional text:
[{"front": "question/concept", "back": "answer/explanation"}, ...]`;

/**
 * 从文本内容生成闪卡
 *
 * @param content - 要转换为闪卡的文本内容
 * @param maxCards - 最大卡片数量（默认 20）
 * @returns 生成的闪卡数组
 */
export async function generateFlashcardsFromText(
  content: string,
  maxCards: number = 20
): Promise<Flashcard[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: FLASHCARD_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Generate flashcards from the following content (maximum ${maxCards} cards):\n\n${content}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4096,
  });

  const responseText = response.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error("No response from OpenAI");
  }

  try {
    // 解析 JSON 响应
    const parsed = JSON.parse(responseText);

    // 支持两种格式：直接数组或 { cards: [...] } 对象
    const cards: Flashcard[] = Array.isArray(parsed)
      ? parsed
      : parsed.cards || parsed.flashcards || [];

    // 验证每张卡片的结构
    const validCards = cards.filter(
      (card): card is Flashcard =>
        typeof card === "object" &&
        card !== null &&
        typeof card.front === "string" &&
        typeof card.back === "string" &&
        card.front.trim().length > 0 &&
        card.back.trim().length > 0
    );

    if (validCards.length === 0) {
      throw new Error("No valid flashcards generated");
    }

    return validCards.slice(0, maxCards);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${responseText}`);
    }
    throw error;
  }
}

export { openai };
