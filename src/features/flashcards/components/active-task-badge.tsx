"use client";

import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getActiveTaskCountAction } from "../actions/tasks";

interface ActiveTaskBadgeProps {
  className?: string;
}

/**
 * 活跃任务数徽章组件
 *
 * 显示当前正在处理的任务数量 (pending + processing)
 * 使用轮询机制每 5 秒刷新一次
 * 仅当有活跃任务时显示
 */
export function ActiveTaskBadge({ className }: ActiveTaskBadgeProps) {
  const [count, setCount] = useState(0);

  const { execute } = useAction(getActiveTaskCountAction, {
    onSuccess: ({ data }) => {
      if (data) {
        setCount(data.count);
      }
    },
  });

  // 稳定的执行函数引用
  const fetchCount = useCallback(() => {
    execute();
  }, [execute]);

  // 初始加载和定时轮询
  useEffect(() => {
    // 立即执行一次
    fetchCount();

    // 每 5 秒轮询一次
    const interval = setInterval(fetchCount, 5000);

    return () => clearInterval(interval);
  }, [fetchCount]);

  // 没有活跃任务时不显示
  if (count === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground",
        "animate-pulse",
        className
      )}
    >
      {count}
    </span>
  );
}
