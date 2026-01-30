import { getAIClient, getAIModel } from "./openai";
import { countTokens, MODEL_TOKEN_LIMITS, truncateToTokens } from "./tokenizer";

/**
 * 章节信息
 */
export interface ChapterInfo {
  /** 章节索引 */
  index: number;
  /** 章节标题 */
  title: string;
  /** 章节摘要（1-2句） */
  summary: string;
  /** 预估起始页 */
  startPage: number;
  /** 预估结束页 */
  endPage: number;
  /** 预估 token 数 */
  estimatedTokens: number;
  /** 文本范围（字符偏移） */
  textRange: {
    start: number;
    end: number;
  };
}

/**
 * 文档大纲
 */
export interface DocumentOutline {
  /** 总页数（估算） */
  totalPages: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 章节列表 */
  chapters: ChapterInfo[];
}

/**
 * LLM 返回的原始章节数据
 */
interface RawChapterData {
  title: string;
  summary: string;
  startMarker: string;
  endMarker?: string;
}

/**
 * 大纲生成的 System Prompt
 */
const OUTLINE_SYSTEM_PROMPT = `You are a document structure analyzer. Your task is to identify the logical sections/chapters in the provided text.

Output ONLY a valid JSON object with this structure:
{
  "chapters": [
    {
      "title": "Section title or heading",
      "summary": "1-2 sentence summary of this section",
      "startMarker": "The first 10-20 words of this section (exact text)"
    }
  ]
}

Rules:
- Identify 3-15 logical sections based on the document structure
- If the document has clear chapter headings, use them
- If no clear chapters exist, identify logical topic divisions
- Keep titles concise (max 10 words)
- Summaries should help readers decide if the section is relevant
- startMarker must be exact text from the beginning of each section
- Sections should be ordered as they appear in the document`;

/**
 * 从文档生成大纲
 *
 * @param text - 文档全文
 * @param options - 生成选项
 * @returns 文档大纲
 */
export async function generateOutline(
  text: string,
  options?: {
    /** 每页估算字符数（默认 2000） */
    charsPerPage?: number;
    /** 最大章节数（默认 15） */
    maxChapters?: number;
  }
): Promise<DocumentOutline> {
  const { charsPerPage = 2000, maxChapters = 15 } = options ?? {};

  const totalTokens = countTokens(text);
  const totalPages = Math.ceil(text.length / charsPerPage);

  // 确保文本在模型限制内
  const maxInputTokens = MODEL_TOKEN_LIMITS["gpt-4o-mini"] - 4000; // 留出空间给输出
  const inputText =
    totalTokens > maxInputTokens ? truncateToTokens(text, maxInputTokens) : text;

  const client = getAIClient();
  const model = getAIModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: OUTLINE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Analyze this document and identify its sections:\n\n${inputText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 4096,
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("No response from AI when generating outline");
  }

  // 解析 LLM 响应
  const parsed = JSON.parse(responseText);
  const rawChapters: RawChapterData[] = parsed.chapters || [];

  // 将 LLM 输出转换为完整的章节信息
  const chapters = buildChapterInfo(text, rawChapters.slice(0, maxChapters), {
    charsPerPage,
  });

  return {
    totalPages,
    totalTokens,
    chapters,
  };
}

/**
 * 根据 LLM 返回的章节数据，构建完整的章节信息
 *
 * 通过 startMarker 在原文中定位章节位置
 */
function buildChapterInfo(
  fullText: string,
  rawChapters: RawChapterData[],
  options: { charsPerPage: number }
): ChapterInfo[] {
  const { charsPerPage } = options;
  const chapters: ChapterInfo[] = [];

  // 查找每个章节的起始位置
  const positions: { index: number; start: number; title: string; summary: string }[] = [];

  for (let i = 0; i < rawChapters.length; i++) {
    const chapter = rawChapters[i];
    if (!chapter) continue;
    const marker = chapter.startMarker.trim();

    // 在全文中查找 marker
    let startPos = fullText.indexOf(marker);

    // 如果精确匹配失败，尝试模糊匹配（取前 50 个字符）
    if (startPos === -1 && marker.length > 50) {
      const shortMarker = marker.slice(0, 50);
      startPos = fullText.indexOf(shortMarker);
    }

    // 如果还是找不到，尝试更短的匹配
    if (startPos === -1 && marker.length > 20) {
      const shorterMarker = marker.slice(0, 20);
      startPos = fullText.indexOf(shorterMarker);
    }

    if (startPos !== -1) {
      positions.push({
        index: i,
        start: startPos,
        title: chapter.title,
        summary: chapter.summary,
      });
    }
  }

  // 按位置排序
  positions.sort((a, b) => a.start - b.start);

  // 构建章节信息
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (!pos) continue;
    const nextPos = positions[i + 1];

    // 计算结束位置
    const end = nextPos ? nextPos.start : fullText.length;

    // 提取章节文本并计算 token
    const chapterText = fullText.slice(pos.start, end);
    const estimatedTokens = countTokens(chapterText);

    // 估算页数范围
    const startPage = Math.floor(pos.start / charsPerPage) + 1;
    const endPage = Math.ceil(end / charsPerPage);

    chapters.push({
      index: i,
      title: pos.title,
      summary: pos.summary,
      startPage,
      endPage,
      estimatedTokens,
      textRange: {
        start: pos.start,
        end,
      },
    });
  }

  // 如果没有找到任何章节，创建一个包含全文的默认章节
  if (chapters.length === 0) {
    chapters.push({
      index: 0,
      title: "Full Document",
      summary: "The entire document content",
      startPage: 1,
      endPage: Math.ceil(fullText.length / charsPerPage),
      estimatedTokens: countTokens(fullText),
      textRange: {
        start: 0,
        end: fullText.length,
      },
    });
  }

  return chapters;
}

/**
 * 从大纲中提取选定章节的文本
 *
 * @param fullText - 文档全文
 * @param outline - 文档大纲
 * @param selectedIndices - 选定的章节索引
 * @returns 选定章节的文本
 */
export function extractSelectedChaptersText(
  fullText: string,
  outline: DocumentOutline,
  selectedIndices: number[]
): string {
  const selectedChapters = outline.chapters.filter((ch) =>
    selectedIndices.includes(ch.index)
  );

  // 按位置排序
  selectedChapters.sort((a, b) => a.textRange.start - b.textRange.start);

  // 提取并合并文本
  const texts = selectedChapters.map((ch) =>
    fullText.slice(ch.textRange.start, ch.textRange.end)
  );

  return texts.join("\n\n---\n\n");
}

/**
 * 计算选定章节的总 token 数
 */
export function calculateSelectedTokens(
  outline: DocumentOutline,
  selectedIndices: number[]
): number {
  return outline.chapters
    .filter((ch) => selectedIndices.includes(ch.index))
    .reduce((sum, ch) => sum + ch.estimatedTokens, 0);
}

/**
 * 根据 token 预算估算生成的卡片数
 *
 * 经验公式：每 1000 token 约生成 3-5 张卡
 */
export function estimateCardCount(tokens: number): {
  min: number;
  max: number;
  average: number;
} {
  const min = Math.floor((tokens / 1000) * 3);
  const max = Math.ceil((tokens / 1000) * 5);
  const average = Math.round((min + max) / 2);

  return { min, max, average };
}
