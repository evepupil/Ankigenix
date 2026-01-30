"use client";

import useSWR from "swr";

/**
 * 任务状态响应类型（API 返回格式）
 */
export interface TaskStatusResponse {
  id: string;
  status:
    | "pending"
    | "analyzing"
    | "outline_ready"
    | "processing"
    | "generating"
    | "completed"
    | "failed";
  sourceType: "text" | "url" | "file" | "video";
  sourceFilename: string | null;
  cardCount: number;
  creditsCost: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  // 大文件优化字段
  documentOutline: {
    totalPages: number;
    totalTokens: number;
    chapters: Array<{
      index: number;
      title: string;
      summary: string;
      startPage: number;
      endPage: number;
      estimatedTokens: number;
    }>;
  } | null;
  totalChunks: number | null;
  completedChunks: number | null;
  deck: {
    id: string;
    title: string;
    description: string | null;
  } | null;
  cards: Array<{
    id: string;
    front: string;
    back: string;
    sortIndex: number;
  }>;
}

/**
 * API fetcher
 */
const fetcher = async (url: string): Promise<TaskStatusResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch task status");
  }
  return res.json();
};

/**
 * 轮询任务状态的 Hook
 *
 * @param taskId - 任务 ID
 * @param options - 配置选项
 * @returns 任务状态和控制方法
 */
export function useTaskStatus(
  taskId: string | null,
  options?: {
    /** 轮询间隔（毫秒），默认 3000 */
    refreshInterval?: number;
    /** 是否启用轮询，默认 true */
    enabled?: boolean;
  }
) {
  const { refreshInterval = 3000, enabled = true } = options ?? {};

  const { data, error, isLoading, mutate } = useSWR<TaskStatusResponse>(
    taskId && enabled ? `/api/tasks/${taskId}` : null,
    fetcher,
    {
      // 仅在任务未完成时持续轮询
      refreshInterval: (latestData: TaskStatusResponse | undefined) => {
        if (!latestData) return refreshInterval;
        if (
          latestData.status === "completed" ||
          latestData.status === "failed"
        ) {
          return 0; // 停止轮询
        }
        // outline_ready 也停止轮询（等待用户操作）
        if (latestData.status === "outline_ready") {
          return 0;
        }
        return refreshInterval;
      },
      revalidateOnFocus: false,
      dedupingInterval: 1000,
    }
  );

  return {
    /** 任务数据 */
    task: data,
    /** 错误信息 */
    error,
    /** 是否正在加载 */
    isLoading,
    /** 是否正在处理中（含分析和生成阶段） */
    isProcessing:
      data?.status === "pending" ||
      data?.status === "analyzing" ||
      data?.status === "processing" ||
      data?.status === "generating",
    /** 大纲已就绪（等待用户选择章节） */
    isOutlineReady: data?.status === "outline_ready",
    /** 是否已完成 */
    isCompleted: data?.status === "completed",
    /** 是否失败 */
    isFailed: data?.status === "failed",
    /** 生成进度（大文件优化） */
    progress:
      data?.totalChunks && data.totalChunks > 0
        ? {
            total: data.totalChunks,
            completed: data.completedChunks ?? 0,
            percentage: Math.round(
              ((data.completedChunks ?? 0) / data.totalChunks) * 100
            ),
          }
        : null,
    /** 手动刷新 */
    refresh: mutate,
  };
}
