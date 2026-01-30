import { Inngest } from "inngest";

/**
 * Inngest 客户端配置
 *
 * 用于发送事件和定义后台函数
 * 支持 Vercel 的长时运行任务（突破 60 秒限制）
 *
 * 环境变量:
 * - INNGEST_EVENT_KEY: 生产/云端事件密钥
 * - INNGEST_SIGNING_KEY: 生产/云端签名密钥
 * - INNGEST_DEV: 开发模式 (1 | 0)
 */
export const inngest = new Inngest({
  id: "ankigenix",
  name: "Ankigenix",
  // 开发模式下使用本地 Dev Server，生产使用事件密钥
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * 事件类型定义
 * 确保类型安全的事件发送
 */
export type Events = {
  "flashcard/generate": {
    data: {
      taskId: string;
      userId: string;
      sourceType: "text" | "file" | "url" | "video";
      sourceContent?: string;
      sourceUrl?: string;
      /** 原始文件名（文件类型时用于确定解析器） */
      sourceFilename?: string;
      creditsCost: number;
      userPlan?: "free" | "pro";
    };
  };
};
