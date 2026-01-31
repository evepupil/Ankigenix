import { extractText, getDocumentProxy } from "unpdf";

/**
 * 从 PDF Buffer 中提取文本
 *
 * @param buffer - PDF 文件的 Buffer
 * @returns 提取的纯文本内容
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // unpdf 需要 Uint8Array 而不是 Buffer
    const uint8Array = new Uint8Array(buffer);
    const { text } = await extractText(uint8Array);

    // text 是每页文本的数组，合并后清理
    const joinedText = text.join("\n");
    const cleanedText = joinedText
      .replace(/\r\n/g, "\n") // 统一换行符
      .replace(/\n{3,}/g, "\n\n") // 合并多个空行
      .trim();

    if (!cleanedText || cleanedText.length < 10) {
      throw new Error("PDF contains no readable text content");
    }

    return cleanedText;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error("Failed to parse PDF: Unknown error");
  }
}

/**
 * 获取 PDF 元数据
 */
export async function getPdfMetadata(buffer: Buffer): Promise<{
  pages: number;
  info: Record<string, unknown>;
}> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    return {
      pages: pdf.numPages ?? 0,
      info: {},
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get PDF metadata: ${error.message}`);
    }
    throw new Error("Failed to get PDF metadata: Unknown error");
  }
}
