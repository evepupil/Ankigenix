import { parsePdf } from "./pdf";
import { parseWord } from "./word";
import { parseMarkdown } from "./markdown";

/**
 * 支持的文件类型
 */
export type SupportedFileType = "pdf" | "docx" | "doc" | "md" | "txt";

/**
 * 文件类型 MIME 映射
 */
export const FILE_MIME_TYPES: Record<string, SupportedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/markdown": "md",
  "text/plain": "txt",
};

/**
 * 文件扩展名映射
 */
export const FILE_EXTENSIONS: Record<string, SupportedFileType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".doc": "doc",
  ".md": "md",
  ".txt": "txt",
};

/**
 * 从文件名获取文件类型
 */
export function getFileTypeFromName(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return FILE_EXTENSIONS[ext] || null;
}

/**
 * 从 MIME 类型获取文件类型
 */
export function getFileTypeFromMime(mimeType: string): SupportedFileType | null {
  return FILE_MIME_TYPES[mimeType] || null;
}

/**
 * 解析文件内容
 *
 * 根据文件类型自动选择合适的解析器
 *
 * @param buffer - 文件 Buffer
 * @param fileType - 文件类型
 * @returns 提取的文本内容
 */
export async function parseFile(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return await parsePdf(buffer);

    case "docx":
    case "doc":
      return await parseWord(buffer);

    case "md":
    case "txt":
      // 文本文件直接转换为字符串
      const content = buffer.toString("utf-8");
      return parseMarkdown(content);

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * 从 URL 下载并解析文件
 *
 * @param url - 文件 URL
 * @param filename - 文件名（用于确定文件类型）
 * @returns 提取的文本内容
 */
export async function parseFileFromUrl(
  url: string,
  filename: string
): Promise<string> {
  const fileType = getFileTypeFromName(filename);

  if (!fileType) {
    throw new Error(`Cannot determine file type from filename: ${filename}`);
  }

  // 下载文件
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return await parseFile(buffer, fileType);
}

// 导出单独的解析器
export { parsePdf, getPdfMetadata } from "./pdf";
export { parseWord, parseWordToHtml } from "./word";
export { parseMarkdown, extractTextFromMarkdown } from "./markdown";
