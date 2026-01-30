import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, File, FileText, Globe, Layers, Video } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import type { SourceType } from "@/db/schema";
import { card, deck } from "@/db/schema";
import { AddCardForm } from "@/features/decks/components/add-card-form";
import { CardEditor } from "@/features/decks/components/card-editor";
import { DeleteDeckButton } from "@/features/decks/components/delete-deck-button";
import { ExportMenu } from "@/features/decks/components/export-menu";
import { auth } from "@/lib/auth";

const sourceTypeConfig: Record<
  SourceType,
  { label: string; icon: typeof FileText }
> = {
  text: { label: "Text", icon: FileText },
  file: { label: "File", icon: File },
  url: { label: "URL", icon: Globe },
  video: { label: "Video", icon: Video },
};

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const deckData = await db.query.deck.findFirst({
    where: and(eq(deck.id, id), eq(deck.userId, session.user.id)),
  });

  if (!deckData) {
    notFound();
  }

  const cards = await db.query.card.findMany({
    where: eq(card.deckId, id),
    orderBy: [asc(card.sortIndex)],
  });

  const sourceConfig = sourceTypeConfig[deckData.sourceType];
  const SourceIcon = sourceConfig.icon;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/decks">
            <ArrowLeft />
            Back to Decks
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {deckData.title}
            </h1>
            <Badge variant="secondary">
              <SourceIcon className="size-3" />
              {sourceConfig.label}
            </Badge>
          </div>
          {deckData.description && (
            <p className="text-muted-foreground">{deckData.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {deckData.cardCount} card{deckData.cardCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ExportMenu deckId={deckData.id} deckTitle={deckData.title} />
          <DeleteDeckButton deckId={deckData.id} deckTitle={deckData.title} />
        </div>
      </div>

      {/* Cards list */}
      <div className="space-y-4">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No cards yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Add your first flashcard to this deck using the form below.
            </p>
          </div>
        ) : (
          cards.map((c) => (
            <CardEditor key={c.id} card={c} deckId={deckData.id} />
          ))
        )}

        {/* Add card form */}
        <AddCardForm deckId={deckData.id} />
      </div>
    </div>
  );
}
