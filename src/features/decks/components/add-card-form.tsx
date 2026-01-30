"use client";

import { Loader2, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCardAction } from "@/features/decks/actions";

interface AddCardFormProps {
  deckId: string;
}

export function AddCardForm({ deckId }: AddCardFormProps) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const { execute, isExecuting, result } = useAction(addCardAction, {
    onSuccess: () => {
      setFront("");
      setBack("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    execute({
      deckId,
      front: front.trim(),
      back: back.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-dashed bg-muted/50 p-4"
    >
      <h3 className="font-medium mb-3">Add New Card</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="add-front">Front</Label>
          <Textarea
            id="add-front"
            placeholder="Question or concept..."
            value={front}
            onChange={(e) => setFront(e.target.value)}
            disabled={isExecuting}
            rows={3}
            className="resize-none bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-back">Back</Label>
          <Textarea
            id="add-back"
            placeholder="Answer or explanation..."
            value={back}
            onChange={(e) => setBack(e.target.value)}
            disabled={isExecuting}
            rows={3}
            className="resize-none bg-background"
          />
        </div>
      </div>
      {result.serverError && (
        <p className="text-sm text-destructive mt-2">{result.serverError}</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          disabled={isExecuting || !front.trim() || !back.trim()}
        >
          {isExecuting ? <Loader2 className="animate-spin" /> : <Plus />}
          Add Card
        </Button>
      </div>
    </form>
  );
}
