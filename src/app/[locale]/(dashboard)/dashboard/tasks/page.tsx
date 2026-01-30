import { desc, eq } from "drizzle-orm";
import { ClipboardList, Sparkles } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { generationTask } from "@/db/schema";
import { TaskCard } from "@/features/flashcards/components/task-card";
import type { TaskListItem } from "@/features/flashcards/actions/tasks";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Tasks | Ankigenix",
  description: "View all your flashcard generation tasks",
};

export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  // 查询用户所有任务
  const tasks = await db.query.generationTask.findMany({
    where: eq(generationTask.userId, session.user.id),
    orderBy: [desc(generationTask.createdAt)],
  });

  // 获取关联的牌组信息
  const deckIds = tasks
    .map((t) => t.deckId)
    .filter((id): id is string => id !== null);

  const decks =
    deckIds.length > 0
      ? await db.query.deck.findMany({
          where: (d, { inArray }) => inArray(d.id, deckIds),
        })
      : [];

  const deckMap = new Map(decks.map((d) => [d.id, d]));

  // 组装任务列表数据
  const taskList: TaskListItem[] = tasks.map((task) => ({
    id: task.id,
    status: task.status as TaskListItem["status"],
    sourceType: task.sourceType as TaskListItem["sourceType"],
    cardCount: task.cardCount,
    creditsCost: task.creditsCost,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    deck: task.deckId
      ? {
          id: task.deckId,
          title: deckMap.get(task.deckId)?.title ?? "Untitled Deck",
        }
      : null,
  }));

  // 按状态分组统计
  const activeCount = taskList.filter(
    (t) => t.status === "pending" || t.status === "processing"
  ).length;
  const completedCount = taskList.filter(
    (t) => t.status === "completed"
  ).length;
  const failedCount = taskList.filter((t) => t.status === "failed").length;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            View all your flashcard generation tasks
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/generate">
            <Sparkles />
            Generate
          </Link>
        </Button>
      </div>

      {/* 统计概览 */}
      {taskList.length > 0 && (
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{taskList.length}</p>
          </div>
          {activeCount > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
              <p className="text-xs text-blue-600">Active</p>
              <p className="text-lg font-bold text-blue-700">{activeCount}</p>
            </div>
          )}
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2">
            <p className="text-xs text-green-600">Completed</p>
            <p className="text-lg font-bold text-green-700">
              {completedCount}
            </p>
          </div>
          {failedCount > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2">
              <p className="text-xs text-red-600">Failed</p>
              <p className="text-lg font-bold text-red-700">{failedCount}</p>
            </div>
          )}
        </div>
      )}

      {/* 任务列表 */}
      {taskList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No tasks yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Generate flashcards from your content to see your tasks here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/generate">
              <Sparkles />
              Generate Flashcards
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {taskList.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
