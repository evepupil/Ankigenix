import { PDFParse } from "pdf-parse";

/**
 * 从 PDF Buffer 中提取文本
 *
 * @param buffer - PDF 文件的 Buffer
 * @returns 提取的纯文本内容
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    // 获取文本内容
    const text = result.text
      .replace(/\r\n/g, "\n") // 统一换行符
      .replace(/\n{3,}/g, "\n\n") // 合并多个空行
      .trim();

    if (!text || text.length < 10) {
      throw new Error("PDF contains no readable text content");
    }

    return text;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error("Failed to parse PDF: Unknown error");
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

/**
 * 获取 PDF 元数据
 */
export async function getPdfMetadata(buffer: Buffer): Promise<{
  pages: number;
  info: Record<string, unknown>;
}> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getInfo();
    return {
      pages: result.total ?? 0,
      info: result.info ?? {},
    };
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}
