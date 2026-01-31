import OpenAI from "openai";

/**
 * AI 提供商类型
 */
export type AIProvider = "openai" | "deepseek" | "mimo";

/**
 * 获取当前配置的 AI 提供商
 */
export function getAIProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || "openai";
}

/**
 * 获取 AI 模型名称
 */
export function getAIModel(): string {
  const provider = getAIProvider();
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_MODEL || "deepseek-chat";
  }
  if (provider === "mimo") {
    return process.env.MIMO_MODEL || "mimo-v2-flash";
  }
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/**
 * OpenAI 客户端实例
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * DeepSeek 客户端实例（使用 OpenAI 兼容模式）
 */
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

/**
 * 小米 MiMo 客户端实例（使用 OpenAI 兼容模式）
 */
const mimo = new OpenAI({
  apiKey: process.env.MIMO_API_KEY,
  baseURL: "https://api.xiaomimimo.com/v1",
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

You MUST respond with a valid JSON object in this exact format:
{"cards": [{"front": "question/concept", "back": "answer/explanation"}, ...]}`;

/**
 * 从文本内容生成闪卡
 *
 * @param content - 要转换为闪卡的文本内容
 * @param maxCards - 最大卡片数量（默认 20）
 * @returns 生成的闪卡数组
 */
/**
 * 获取当前活跃的 AI 客户端
 */
function getAIClient(): OpenAI {
  const provider = getAIProvider();
  if (provider === "deepseek") return deepseek;
  if (provider === "mimo") return mimo;
  return openai;
}

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
  const client = getAIClient();
  const model = getAIModel();

  const response = await client.chat.completions.create({
    model,
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
  const provider = getAIProvider();

  if (!responseText) {
    const providerNames: Record<AIProvider, string> = {
      openai: "OpenAI",
      deepseek: "DeepSeek",
      mimo: "MiMo",
    };
    throw new Error(`No response from ${providerNames[provider]}`);
  }

  try {
    // 清理可能的 markdown 代码块包裹
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```")) {
      // 移除开头的 ```json 或 ``` 和结尾的 ```
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    // 解析 JSON 响应
    const parsed = JSON.parse(cleanedResponse);

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
    const provider = getAIProvider();
    const providerNames: Record<AIProvider, string> = {
      openai: "OpenAI",
      deepseek: "DeepSeek",
      mimo: "MiMo",
    };
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse ${providerNames[provider]} response as JSON: ${responseText}`
      );
    }
    throw error;
  }
}

export { openai, deepseek, mimo, getAIClient };
