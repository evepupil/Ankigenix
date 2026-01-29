import { serve } from "inngest/next";
import { inngest, functions } from "@/inngest";

/**
 * Inngest API 路由
 *
 * 处理 Inngest 的 webhook 请求
 * 支持开发模式和生产模式
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
