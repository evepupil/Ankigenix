"use client";

import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { deleteCardAction, updateCardAction } from "@/features/decks/actions";

interface CardEditorProps {
  card: {
    id: string;
    front: string;
    back: string;
    sortIndex: number;
  };
  deckId: string;
}

export function CardEditor({ card, deckId: _deckId }: CardEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(
    updateCardAction,
    {
      onSuccess: () => {
        setIsEditing(false);
      },
    }
  );

  const { execute: executeDelete, isExecuting: isDeleting } = useAction(
    deleteCardAction,
    {
      onSuccess: () => {
        setDeleteOpen(false);
      },
    }
  );

  const handleSave = () => {
    if (!front.trim() || !back.trim()) return;
    executeUpdate({
      cardId: card.id,
      front: front.trim(),
      back: back.trim(),
    });
  };

  const handleCancel = () => {
    setFront(card.front);
    setBack(card.back);
    setIsEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline">#{card.sortIndex + 1}</Badge>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCancel}
                disabled={isUpdating}
              >
                <X className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSave}
                disabled={isUpdating || !front.trim() || !back.trim()}
              >
                {isUpdating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[380px]">
                  <DialogHeader>
                    <DialogTitle>Delete Card</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this card? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteOpen(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => executeDelete({ cardId: card.id })}
                      disabled={isDeleting}
                    >
                      {isDeleting && <Loader2 className="animate-spin" />}
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Front
          </p>
          {isEditing ? (
            <Textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              disabled={isUpdating}
              rows={3}
              className="resize-none"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{card.front}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Back</p>
          {isEditing ? (
            <Textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              disabled={isUpdating}
              rows={3}
              className="resize-none"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{card.back}</p>
          )}
        </div>
      </div>
    </div>
  );
}
