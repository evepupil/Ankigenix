"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

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
import { deleteDeckAction } from "@/features/decks/actions";

interface DeleteDeckButtonProps {
  deckId: string;
  deckTitle: string;
}

export function DeleteDeckButton({ deckId, deckTitle }: DeleteDeckButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { execute, isExecuting } = useAction(deleteDeckAction, {
    onSuccess: () => {
      setOpen(false);
      router.push("/dashboard/decks");
    },
  });

  const handleDelete = () => {
    execute({ deckId });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Deck</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{deckTitle}&quot;? This action
            cannot be undone and all cards in this deck will be permanently
            removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isExecuting}
          >
            {isExecuting && <Loader2 className="animate-spin" />}
            Delete Deck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
