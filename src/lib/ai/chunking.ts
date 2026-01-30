import { countTokens, truncateToTokens } from "./tokenizer";

/**
 * 文本分块配置
 */
export interface ChunkOptions {
  /** 每块最大 token 数（默认 3500） */
  maxTokens?: number;
  /** 重叠 token 数（默认 200） */
  overlap?: number;
  /** 分块策略 */
  strategy?: "paragraph" | "sentence" | "fixed";
}

/**
 * 文本块
 */
export interface TextChunk {
  /** 块索引 */
  index: number;
  /** 块内容 */
  text: string;
  /** Token 数量 */
  tokenCount: number;
  /** 在原文中的起始位置 */
  startOffset: number;
  /** 在原文中的结束位置 */
  endOffset: number;
}

const DEFAULT_MAX_TOKENS = 3500;
const DEFAULT_OVERLAP = 200;

/**
 * 将文本分割成多个块
 *
 * @param text - 要分块的文本
 * @param options - 分块选项
 * @returns 文本块数组
 */
export function splitIntoChunks(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    overlap = DEFAULT_OVERLAP,
    strategy = "paragraph",
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const totalTokens = countTokens(text);

  // 如果文本很短，直接返回单个块
  if (totalTokens <= maxTokens) {
    return [
      {
        index: 0,
        text,
        tokenCount: totalTokens,
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  switch (strategy) {
    case "paragraph":
      return splitByParagraph(text, maxTokens, overlap);
    case "sentence":
      return splitBySentence(text, maxTokens, overlap);
    case "fixed":
      return splitFixed(text, maxTokens, overlap);
    default:
      return splitByParagraph(text, maxTokens, overlap);
  }
}

/**
 * 按段落分割
 *
 * 优先在段落边界分割，保持语义完整性
 */
function splitByParagraph(
  text: string,
  maxTokens: number,
  overlap: number
): TextChunk[] {
  // 按段落分割（双换行或多个换行）
  const paragraphs = text.split(/\n{2,}/);
  const chunks: TextChunk[] = [];

  let currentChunk = "";
  let currentOffset = 0;
  let chunkStartOffset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const rawParagraph = paragraphs[i];
    if (!rawParagraph) continue;
    const paragraph = rawParagraph.trim();
    if (!paragraph) {
      currentOffset += 2; // 跳过空段落
      continue;
    }

    const testChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;
    const testTokens = countTokens(testChunk);

    if (testTokens > maxTokens) {
      // 当前块已满，保存并开始新块
      if (currentChunk) {
        chunks.push({
          index: chunks.length,
          text: currentChunk,
          tokenCount: countTokens(currentChunk),
          startOffset: chunkStartOffset,
          endOffset: currentOffset,
        });

        // 计算重叠：从当前块末尾取一些内容
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
        chunkStartOffset = currentOffset - (overlapText?.length || 0);
      } else {
        // 单个段落超过限制，需要进一步分割
        const splitParagraphs = splitLongParagraph(
          paragraph,
          maxTokens,
          overlap
        );
        for (const sp of splitParagraphs) {
          chunks.push({
            index: chunks.length,
            text: sp.text,
            tokenCount: sp.tokenCount,
            startOffset: currentOffset + sp.startOffset,
            endOffset: currentOffset + sp.endOffset,
          });
        }
        currentChunk = "";
        chunkStartOffset = currentOffset + paragraph.length + 2;
      }
    } else {
      currentChunk = testChunk;
    }

    currentOffset += paragraph.length + 2; // +2 for \n\n
  }

  // 保存最后一个块
  if (currentChunk) {
    chunks.push({
      index: chunks.length,
      text: currentChunk,
      tokenCount: countTokens(currentChunk),
      startOffset: chunkStartOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * 按句子分割
 */
function splitBySentence(
  text: string,
  maxTokens: number,
  overlap: number
): TextChunk[] {
  // 按句子分割（句号、问号、感叹号）
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  const chunks: TextChunk[] = [];

  let currentChunk = "";
  let currentOffset = 0;
  let chunkStartOffset = 0;

  for (const sentence of sentences) {
    const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    const testTokens = countTokens(testChunk);

    if (testTokens > maxTokens && currentChunk) {
      chunks.push({
        index: chunks.length,
        text: currentChunk,
        tokenCount: countTokens(currentChunk),
        startOffset: chunkStartOffset,
        endOffset: currentOffset,
      });

      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText ? `${overlapText} ${sentence}` : sentence;
      chunkStartOffset = currentOffset - (overlapText?.length || 0);
    } else {
      currentChunk = testChunk;
    }

    currentOffset += sentence.length + 1;
  }

  if (currentChunk) {
    chunks.push({
      index: chunks.length,
      text: currentChunk,
      tokenCount: countTokens(currentChunk),
      startOffset: chunkStartOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * 固定大小分割
 */
function splitFixed(
  text: string,
  maxTokens: number,
  overlap: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentOffset = 0;

  while (currentOffset < text.length) {
    // 获取从当前位置开始的 maxTokens 个 token
    const remainingText = text.slice(currentOffset);
    const chunkText = truncateToTokens(remainingText, maxTokens);
    const tokenCount = countTokens(chunkText);

    chunks.push({
      index: chunks.length,
      text: chunkText,
      tokenCount,
      startOffset: currentOffset,
      endOffset: currentOffset + chunkText.length,
    });

    // 下一个块的起始位置（考虑重叠）
    const overlapChars = Math.floor(
      (overlap / tokenCount) * chunkText.length
    );
    currentOffset += chunkText.length - overlapChars;

    // 防止无限循环
    if (chunkText.length === 0) break;
  }

  return chunks;
}

/**
 * 分割过长的单个段落
 */
function splitLongParagraph(
  paragraph: string,
  maxTokens: number,
  overlap: number
): TextChunk[] {
  // 先尝试按句子分割
  const sentences = paragraph.split(/(?<=[.!?。！？])\s*/);

  if (sentences.length > 1) {
    return splitBySentence(paragraph, maxTokens, overlap);
  }

  // 如果没有句子边界，使用固定分割
  return splitFixed(paragraph, maxTokens, overlap);
}

/**
 * 获取重叠文本
 */
function getOverlapText(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return "";

  const tokens = countTokens(text);
  if (tokens <= overlapTokens) return text;

  // 从末尾截取指定 token 数的文本
  // 简单实现：估算字符数
  const avgCharsPerToken = text.length / tokens;
  const overlapChars = Math.floor(overlapTokens * avgCharsPerToken);

  return text.slice(-overlapChars);
}

/**
 * 根据章节范围提取文本
 *
 * @param fullText - 完整文本
 * @param ranges - 字符范围数组
 * @returns 提取的文本
 */
export function extractTextByRanges(
  fullText: string,
  ranges: Array<{ start: number; end: number }>
): string {
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  const texts: string[] = [];

  for (const range of sortedRanges) {
    texts.push(fullText.slice(range.start, range.end));
  }

  return texts.join("\n\n");
}
