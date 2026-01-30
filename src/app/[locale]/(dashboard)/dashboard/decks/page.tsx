import { desc, eq } from "drizzle-orm";
import { Layers, Plus } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { deck } from "@/db/schema";
import { CreateDeckDialog } from "@/features/decks/components/create-deck-dialog";
import { DeckCard } from "@/features/decks/components/deck-card";
import { auth } from "@/lib/auth";

export default async function DecksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const decks = await db.query.deck.findMany({
    where: eq(deck.userId, session.user.id),
    orderBy: [desc(deck.createdAt)],
  });

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Decks</h1>
          <p className="text-muted-foreground">Manage your flashcard decks</p>
        </div>
        <CreateDeckDialog>
          <Button>
            <Plus />
            Create Deck
          </Button>
        </CreateDeckDialog>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Layers className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No decks yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Generate flashcards from your content or create a deck manually to
            get started.
          </p>
          <CreateDeckDialog>
            <Button className="mt-4">
              <Plus />
              Create Your First Deck
            </Button>
          </CreateDeckDialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <DeckCard key={d.id} deck={d} />
          ))}
        </div>
      )}
    </div>
  );
}
