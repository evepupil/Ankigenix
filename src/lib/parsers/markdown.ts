/**
 * 解析 Markdown 文件
 *
 * Markdown 本身已是文本格式，主要做清理和格式化
 *
 * @param content - Markdown 文件内容
 * @returns 清理后的文本内容
 */
export function parseMarkdown(content: string): string {
  // Markdown 已是纯文本，直接清理即可
  const text = content
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text || text.length < 10) {
    throw new Error("Markdown file contains no readable content");
  }

  return text;
}

/**
 * 从 Markdown 中提取纯文本（移除格式标记）
 *
 * 移除：标题标记、链接、图片、代码块等
 */
export function extractTextFromMarkdown(content: string): string {
  return content
    // 移除代码块
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    // 移除图片
    .replace(/!\[.*?\]\(.*?\)/g, "")
    // 转换链接为纯文本
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, "")
    // 移除粗体/斜体标记
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // 移除列表标记
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // 移除引用标记
    .replace(/^>\s+/gm, "")
    // 移除水平线
    .replace(/^[-*_]{3,}$/gm, "")
    // 清理多余空行
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
