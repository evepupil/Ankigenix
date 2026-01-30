"use client";

import {
  BookOpen,
  CheckCircle2,
  Loader2,
  ScanSearch,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTaskStatus } from "@/features/flashcards/hooks/use-task-status";

interface TaskStatusDisplayProps {
  taskId: string;
  onComplete?: (deckId: string) => void;
  onRetry?: () => void;
  /** 当大纲就绪时的回调（大文件优化） */
  onOutlineReady?: () => void;
}

export function TaskStatusDisplay({
  taskId,
  onComplete,
  onRetry,
  onOutlineReady,
}: TaskStatusDisplayProps) {
  const { task, isLoading, isCompleted, isOutlineReady, progress, error } =
    useTaskStatus(taskId);

  // Call onComplete callback when task completes
  useEffect(() => {
    if (isCompleted && task?.deck?.id && onComplete) {
      onComplete(task.deck.id);
    }
  }, [isCompleted, task?.deck?.id, onComplete]);

  // Call onOutlineReady callback
  useEffect(() => {
    if (isOutlineReady && onOutlineReady) {
      onOutlineReady();
    }
  }, [isOutlineReady, onOutlineReady]);

  // Initial loading state
  if (isLoading && !task) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading task status...
        </span>
      </div>
    );
  }

  // Error fetching task
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-3">
          <XCircle className="size-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Failed to load task
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error.message}
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  // Pending state
  if (task.status === "pending") {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Queued</p>
            <p className="text-xs text-muted-foreground">
              Waiting to process your content...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Analyzing state (Phase A - generating outline)
  if (task.status === "analyzing") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
        <div className="flex items-center gap-3">
          <ScanSearch className="size-5 animate-pulse text-violet-600 dark:text-violet-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Analyzing document</p>
            <p className="text-xs text-muted-foreground">
              Extracting structure and generating outline...
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-900/50">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-violet-500" />
          </div>
        </div>
      </div>
    );
  }

  // Outline ready state (waiting for user selection)
  if (task.status === "outline_ready") {
    const chapterCount = task.documentOutline?.chapters?.length ?? 0;
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-center gap-3">
          <BookOpen className="size-5 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Outline ready
            </p>
            <p className="text-xs text-muted-foreground">
              {chapterCount} chapters found. Select which chapters to generate
              flashcards from.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Processing state (legacy flow)
  if (task.status === "processing") {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Generating flashcards</p>
            <p className="text-xs text-muted-foreground">
              AI is analyzing your content and creating cards...
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Generating state (Phase B - parallel chunk generation)
  if (task.status === "generating") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Generating flashcards</p>
            <p className="text-xs text-muted-foreground">
              {progress
                ? `Processing chunk ${progress.completed}/${progress.total}...`
                : "Splitting content and generating cards in parallel..."}
            </p>
          </div>
          {progress && (
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {progress.percentage}%
            </span>
          )}
        </div>
        <div className="mt-3">
          <Progress
            value={progress?.percentage ?? 0}
            className="h-2"
          />
        </div>
      </div>
    );
  }

  // Completed state
  if (task.status === "completed") {
    return (
      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Generated {task.cardCount}{" "}
              {task.cardCount === 1 ? "card" : "cards"}!
            </p>
            <p className="text-xs text-muted-foreground">
              Your flashcards are ready to review
            </p>
          </div>
          {task.deck && (
            <Button asChild size="sm">
              <Link href={`/dashboard/decks/${task.deck.id}`}>View Deck</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Failed state
  if (task.status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-3">
          <XCircle className="size-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Generation failed
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {task.errorMessage || "An unexpected error occurred"}
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
