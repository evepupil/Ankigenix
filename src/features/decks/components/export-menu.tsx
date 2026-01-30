"use client";

import { Download, FileDown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  deckId: string;
  deckTitle: string;
}

export function ExportMenu({ deckId, deckTitle }: ExportMenuProps) {
  const handleExport = (format: "apkg" | "markdown") => {
    const endpoint =
      format === "apkg"
        ? `/api/export/apkg?deckId=${deckId}`
        : `/api/export/markdown?deckId=${deckId}`;

    // Create a temporary anchor element to trigger download
    const link = document.createElement("a");
    link.href = endpoint;
    link.download = format === "apkg" ? `${deckTitle}.apkg` : `${deckTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("apkg")}>
          <FileDown />
          Export as Anki (.apkg)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          <FileText />
          Export as Markdown (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
