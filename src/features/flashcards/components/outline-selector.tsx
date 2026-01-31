"use client";

import { BookOpen, Coins, FileText, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateCreationCost } from "@/config/pricing";
import { cn } from "@/lib/utils";

interface ChapterInfo {
  index: number;
  title: string;
  summary: string;
  startPage: number;
  endPage: number;
  estimatedTokens: number;
}

interface DocumentOutline {
  totalPages: number;
  totalTokens: number;
  chapters: ChapterInfo[];
}

interface OutlineSelectorProps {
  outline: DocumentOutline;
  filename?: string | null;
  onGenerate: (selectedChapters: number[]) => void;
  isGenerating?: boolean;
}

/**
 * 格式化 token 数为可读文本
 */
function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * 估算卡片数量
 */
function estimateCards(tokens: number): { min: number; max: number } {
  const min = Math.floor((tokens / 1000) * 3);
  const max = Math.ceil((tokens / 1000) * 5);
  return { min: Math.max(1, min), max: Math.max(1, max) };
}

/**
 * 文档大纲章节选择器
 *
 * 显示 AI 生成的文档大纲，用户可选择要生成闪卡的章节
 * 底部显示选中的 token 总数、预估卡片数、积分消耗
 */
export function OutlineSelector({
  outline,
  filename,
  onGenerate,
  isGenerating = false,
}: OutlineSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(outline.chapters.map((ch) => ch.index))
  );

  const toggleChapter = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIndices((prev) => {
      if (prev.size === outline.chapters.length) {
        return new Set();
      }
      return new Set(outline.chapters.map((ch) => ch.index));
    });
  }, [outline.chapters]);

  const stats = useMemo(() => {
    const selectedChapters = outline.chapters.filter((ch) =>
      selectedIndices.has(ch.index)
    );
    const totalTokens = selectedChapters.reduce(
      (sum, ch) => sum + ch.estimatedTokens,
      0
    );
    const credits = calculateCreationCost(totalTokens);
    const cards = estimateCards(totalTokens);
    return {
      selectedCount: selectedChapters.length,
      totalTokens,
      credits,
      cards,
    };
  }, [outline.chapters, selectedIndices]);

  const allSelected = selectedIndices.size === outline.chapters.length;

  const handleGenerate = useCallback(() => {
    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    onGenerate(selected);
  }, [selectedIndices, onGenerate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Document Outline</h3>
            {filename && (
              <p className="text-xs text-muted-foreground">{filename}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{outline.totalPages} pages</span>
          <span>{formatTokens(outline.totalTokens)} tokens</span>
        </div>
      </div>

      {/* Select All */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <label
          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          htmlFor="select-all"
        >
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          Select all ({outline.chapters.length} chapters)
        </label>
        <span className="text-xs text-muted-foreground">
          {stats.selectedCount} selected
        </span>
      </div>

      {/* Chapter List */}
      <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-lg border p-2">
        {outline.chapters.map((chapter) => {
          const isSelected = selectedIndices.has(chapter.index);
          return (
            <label
              key={chapter.index}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                isSelected
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-muted/50"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleChapter(chapter.index)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium leading-tight">
                    {chapter.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {chapter.summary}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3" />
                    p.{chapter.startPage}-{chapter.endPage}
                  </span>
                  <span>{formatTokens(chapter.estimatedTokens)} tokens</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Stats & Generate */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              <span className="font-medium">{stats.selectedCount}</span>{" "}
              <span className="text-muted-foreground">chapters</span>
            </span>
            <span>
              <span className="font-medium">
                {formatTokens(stats.totalTokens)}
              </span>{" "}
              <span className="text-muted-foreground">tokens</span>
            </span>
            <span>
              ~<span className="font-medium">{stats.cards.min}-{stats.cards.max}</span>{" "}
              <span className="text-muted-foreground">cards</span>
            </span>
            <span className="flex items-center gap-1">
              <Coins className="size-3.5 text-amber-500" />
              <span className="text-muted-foreground">Estimated:</span>{" "}
              <span className="font-medium">{stats.credits.toFixed(2)}</span>{" "}
              <span className="text-muted-foreground">credits</span>
            </span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={stats.selectedCount === 0 || isGenerating}
          className="mt-3 w-full gap-2"
          size="lg"
        >
          <Sparkles className="size-5" />
          {isGenerating
            ? "Starting Generation..."
            : `Generate from ${stats.selectedCount} Chapter${stats.selectedCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
