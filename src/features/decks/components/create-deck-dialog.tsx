"use client";

import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeckAction } from "@/features/decks/actions";

interface CreateDeckDialogProps {
  children: React.ReactNode;
}

export function CreateDeckDialog({ children }: CreateDeckDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { execute, isExecuting, result } = useAction(createDeckAction, {
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    execute({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Deck</DialogTitle>
            <DialogDescription>
              Create a new flashcard deck. You can add cards manually or
              generate them from content later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter deck title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isExecuting}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter deck description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isExecuting}
                maxLength={500}
                rows={3}
              />
            </div>
            {result.serverError && (
              <p className="text-sm text-destructive">{result.serverError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isExecuting || !title.trim()}>
              {isExecuting && <Loader2 className="animate-spin" />}
              Create Deck
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
