import mammoth from "mammoth";

/**
 * 从 Word 文档 Buffer 中提取文本
 *
 * 支持 .docx 格式
 *
 * @param buffer - Word 文件的 Buffer
 * @returns 提取的纯文本内容
 */
export async function parseWord(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    // 清理提取的文本
    const text = result.value
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 10) {
      throw new Error("Word document contains no readable text content");
    }

    // 记录警告信息（如有）
    if (result.messages.length > 0) {
      console.warn("Word parsing warnings:", result.messages);
    }

    return text;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Word document: ${error.message}`);
    }
    throw new Error("Failed to parse Word document: Unknown error");
  }
}

/**
 * 从 Word 文档提取 HTML（保留格式）
 *
 * 适用于需要保留基本格式的场景
 */
export async function parseWordToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}
