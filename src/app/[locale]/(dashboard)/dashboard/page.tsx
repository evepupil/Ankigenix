import { count, desc, eq, sql, inArray } from "drizzle-orm";
import {
  BookOpen,
  Coins,
  Layers,
  ListTodo,
  Plus,
  Sparkles,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import {
  creditsBalance,
  deck,
  generationTask,
} from "@/db/schema";
import { TaskCard } from "@/features/flashcards/components/task-card";
import type { TaskListItem } from "@/features/flashcards/actions/tasks";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const userId = session.user.id;

  // Fetch stats in parallel
  const [decksData, cardsData, balanceData, tasksData] = await Promise.all([
    // Total decks count
    db
      .select({ count: count() })
      .from(deck)
      .where(eq(deck.userId, userId)),
    // Total cards count (via decks)
    db
      .select({ total: sql<number>`COALESCE(SUM(${deck.cardCount}), 0)` })
      .from(deck)
      .where(eq(deck.userId, userId)),
    // Credits balance
    db.query.creditsBalance.findFirst({
      where: eq(creditsBalance.userId, userId),
    }),
    // Recent tasks (last 5)
    db.query.generationTask.findMany({
      where: eq(generationTask.userId, userId),
      orderBy: [desc(generationTask.createdAt)],
      limit: 5,
    }),
  ]);

  const totalDecks = decksData[0]?.count ?? 0;
  const totalCards = Number(cardsData[0]?.total ?? 0);
  const credits = balanceData?.balance ?? 0;
  const activeTasks = tasksData.filter(
    (t) => t.status === "pending" || t.status === "processing" || t.status === "analyzing" || t.status === "generating"
  ).length;

  // Get deck info for tasks
  const deckIds = tasksData
    .map((t) => t.deckId)
    .filter((id): id is string => id !== null);

  const decksMap = new Map<string, { id: string; title: string }>();
  if (deckIds.length > 0) {
    const decks = await db.query.deck.findMany({
      where: inArray(deck.id, deckIds),
      columns: { id: true, title: true },
    });
    for (const d of decks) {
      decksMap.set(d.id, d);
    }
  }

  // Transform tasks to TaskListItem format
  const recentTasks: TaskListItem[] = tasksData.map((task) => ({
    id: task.id,
    status: task.status as TaskListItem["status"],
    sourceType: task.sourceType as TaskListItem["sourceType"],
    sourceFilename: task.sourceFilename,
    cardCount: task.cardCount,
    indexingCost: task.indexingCost,
    creditsCost: task.creditsCost,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    documentOutline: task.documentOutline as TaskListItem["documentOutline"],
    totalChunks: task.totalChunks,
    completedChunks: task.completedChunks,
    deck: task.deckId ? decksMap.get(task.deckId) ?? null : null,
  }));

  return (
    <div className="container mx-auto space-y-8 px-4 py-6 md:px-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your flashcards.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Decks</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDecks}</div>
            <p className="text-xs text-muted-foreground">
              Your flashcard collections
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCards}</div>
            <p className="text-xs text-muted-foreground">
              Across all your decks
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasks}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Button asChild size="lg">
          <Link href="/dashboard/generate">
            <Sparkles className="mr-2 h-5 w-5" />
            Generate Flashcards
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard/decks">
            <Layers className="mr-2 h-5 w-5" />
            View All Decks
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard/tasks">
            <ListTodo className="mr-2 h-5 w-5" />
            View All Tasks
          </Link>
        </Button>
      </div>

      {/* Recent Tasks */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Tasks</h2>
          {recentTasks.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tasks">View all</Link>
            </Button>
          )}
        </div>

        {recentTasks.length === 0 ? (
          <Card className="border-border shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">No tasks yet</h3>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Generate your first flashcards to get started!
              </p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/generate">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Flashcards
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
