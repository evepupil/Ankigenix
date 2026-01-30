import { File, FileText, Globe, Video } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SourceType } from "@/db/schema";
import { cn } from "@/lib/utils";

interface DeckCardProps {
  deck: {
    id: string;
    title: string;
    description: string | null;
    sourceType: SourceType;
    cardCount: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

const sourceTypeConfig: Record<
  SourceType,
  {
    label: string;
    icon: typeof FileText;
    variant: "default" | "secondary" | "outline";
  }
> = {
  text: { label: "Text", icon: FileText, variant: "secondary" },
  file: { label: "File", icon: File, variant: "secondary" },
  url: { label: "URL", icon: Globe, variant: "secondary" },
  video: { label: "Video", icon: Video, variant: "secondary" },
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
}

export function DeckCard({ deck }: DeckCardProps) {
  const sourceConfig = sourceTypeConfig[deck.sourceType];
  const SourceIcon = sourceConfig.icon;

  return (
    <Link href={`/dashboard/decks/${deck.id}`} className="block">
      <Card
        className={cn(
          "h-full transition-all duration-200",
          "hover:shadow-md hover:border-primary/20",
          "cursor-pointer"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">
              {deck.title}
            </CardTitle>
            <Badge variant={sourceConfig.variant} className="shrink-0">
              <SourceIcon className="size-3" />
              {sourceConfig.label}
            </Badge>
          </div>
          {deck.description && (
            <CardDescription className="line-clamp-2">
              {deck.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
            </span>
            <span>{formatRelativeTime(deck.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
