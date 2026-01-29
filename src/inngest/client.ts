import { Inngest } from "inngest";

/**
 * Inngest 客户端配置
 *
 * 用于发送事件和定义后台函数
 * 支持 Vercel 的长时运行任务（突破 60 秒限制）
 */
export const inngest = new Inngest({
  id: "ankigenix",
  name: "Ankigenix",
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
      creditsCost: number;
      userPlan?: "free" | "pro";
    };
  };
};
