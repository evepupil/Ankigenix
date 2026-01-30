"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  ScanSearch,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "../actions/tasks";

interface TaskCardProps {
  task: TaskListItem;
}

/**
 * 获取来源类型的图标和标签
 */
function getSourceTypeInfo(sourceType: TaskListItem["sourceType"]) {
  switch (sourceType) {
    case "text":
      return { icon: FileText, label: "Text" };
    case "file":
      return { icon: Upload, label: "File" };
    case "url":
      return { icon: Globe, label: "URL" };
    case "video":
      return { icon: Video, label: "Video" };
    default:
      return { icon: FileText, label: "Unknown" };
  }
}

/**
 * 获取状态的图标、颜色和标签
 */
function getStatusInfo(status: TaskListItem["status"]) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        label: "Queued",
        className: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400",
        iconClassName: "text-amber-600 dark:text-amber-400",
      };
    case "analyzing":
      return {
        icon: ScanSearch,
        label: "Analyzing",
        className: "text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400",
        iconClassName: "text-violet-600 dark:text-violet-400 animate-pulse",
      };
    case "outline_ready":
      return {
        icon: BookOpen,
        label: "Outline Ready",
        className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400",
        iconClassName: "text-emerald-600 dark:text-emerald-400",
      };
    case "processing":
      return {
        icon: Loader2,
        label: "Processing",
        className: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400",
        iconClassName: "text-blue-600 dark:text-blue-400 animate-spin",
      };
    case "generating":
      return {
        icon: Loader2,
        label: "Generating",
        className: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400",
        iconClassName: "text-blue-600 dark:text-blue-400 animate-spin",
      };
    case "completed":
      return {
        icon: CheckCircle2,
        label: "Completed",
        className: "text-green-600 bg-green-50 dark:bg-green-950/50 dark:text-green-400",
        iconClassName: "text-green-600 dark:text-green-400",
      };
    case "failed":
      return {
        icon: AlertCircle,
        label: "Failed",
        className: "text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400",
        iconClassName: "text-red-600 dark:text-red-400",
      };
    default:
      return {
        icon: Clock,
        label: "Unknown",
        className: "text-muted-foreground bg-muted",
        iconClassName: "text-muted-foreground",
      };
  }
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  }
  if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  }
  return new Date(date).toLocaleDateString();
}

/**
 * 任务卡片组件
 *
 * 显示单个任务的状态、来源类型、卡片数量等信息
 * 点击可跳转到关联牌组（已完成）或显示状态（进行中）
 */
export function TaskCard({ task }: TaskCardProps) {
  const statusInfo = getStatusInfo(task.status);
  const sourceInfo = getSourceTypeInfo(task.sourceType);
  const StatusIcon = statusInfo.icon;
  const SourceIcon = sourceInfo.icon;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-4 transition-all hover:shadow-md",
        (task.status === "processing" || task.status === "generating") && "border-blue-200 dark:border-blue-800",
        task.status === "analyzing" && "border-violet-200 dark:border-violet-800",
        task.status === "outline_ready" && "border-emerald-200 dark:border-emerald-800",
        task.status === "failed" && "border-red-200 dark:border-red-800"
      )}
    >
      <div className="flex items-start gap-4">
        {/* 状态图标 */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            statusInfo.className
          )}
        >
          <StatusIcon className={cn("h-5 w-5", statusInfo.iconClassName)} />
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 状态标签 */}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                statusInfo.className
              )}
            >
              {statusInfo.label}
            </span>

            {/* 来源类型 */}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <SourceIcon className="h-3 w-3" />
              {sourceInfo.label}
            </span>

            {/* 积分消耗 */}
            <span className="text-xs text-muted-foreground">
              {task.creditsCost} credit{task.creditsCost > 1 ? "s" : ""}
            </span>
          </div>

          {/* 卡片数量或错误信息 */}
          <div className="mt-1">
            {task.status === "completed" && (
              <p className="text-sm font-medium">
                {task.cardCount} card{task.cardCount !== 1 ? "s" : ""} generated
              </p>
            )}
            {task.status === "failed" && task.errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 line-clamp-2">
                {task.errorMessage}
              </p>
            )}
            {task.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Waiting in queue...
              </p>
            )}
            {task.status === "analyzing" && (
              <p className="text-sm text-muted-foreground">
                Analyzing document structure...
              </p>
            )}
            {task.status === "outline_ready" && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {task.documentOutline?.chapters?.length ?? 0} chapters ready for selection
              </p>
            )}
            {task.status === "processing" && (
              <p className="text-sm text-muted-foreground">
                Generating flashcards...
              </p>
            )}
            {task.status === "generating" && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {task.totalChunks && task.completedChunks !== null
                    ? `Generating: ${task.completedChunks}/${task.totalChunks} chunks`
                    : "Generating flashcards in parallel..."}
                </p>
                {task.totalChunks && task.totalChunks > 0 && (
                  <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${Math.round(((task.completedChunks ?? 0) / task.totalChunks) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 时间信息 */}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatRelativeTime(task.createdAt)}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="shrink-0">
          {task.status === "completed" && task.deck && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/decks/${task.deck.id}`}>
                <span>View Deck</span>
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 牌组名称（如果有） */}
      {task.deck && task.status === "completed" && (
        <div className="mt-3 pt-3 border-t">
          <Link
            href={`/dashboard/decks/${task.deck.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {task.deck.title}
          </Link>
        </div>
      )}
    </div>
  );
}
