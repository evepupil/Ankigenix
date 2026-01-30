"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTaskStatus } from "@/features/flashcards/hooks/use-task-status";

interface TaskStatusDisplayProps {
  taskId: string;
  onComplete?: (deckId: string) => void;
  onRetry?: () => void;
}

export function TaskStatusDisplay({
  taskId,
  onComplete,
  onRetry,
}: TaskStatusDisplayProps) {
  const { task, isLoading, isCompleted, error } = useTaskStatus(taskId);

  // Call onComplete callback when task completes
  useEffect(() => {
    if (isCompleted && task?.deck?.id && onComplete) {
      onComplete(task.deck.id);
    }
  }, [isCompleted, task?.deck?.id, onComplete]);

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

  // Processing state
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
