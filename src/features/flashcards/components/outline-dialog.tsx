"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateFromOutlineAction } from "../actions/generate";
import { OutlineSelector } from "./outline-selector";
import type { TaskListItem } from "../actions/tasks";

interface OutlineDialogProps {
  task: TaskListItem;
  children: React.ReactNode;
}

/**
 * 大纲选择对话框
 *
 * 包装 OutlineSelector 在 Dialog 中，处理：
 * - Dialog 打开/关闭状态
 * - 调用 generateFromOutlineAction
 * - 成功后关闭 Dialog 并刷新页面
 * - 错误处理和 Toast 提示
 */
export function OutlineDialog({ task, children }: OutlineDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = async (selectedChapters: number[]) => {
    startTransition(async () => {
      try {
        const result = await generateFromOutlineAction({
          taskId: task.id,
          selectedChapters,
        });

        if (result?.data?.success) {
          toast.success("Generation started!", {
            description: `Generating flashcards from ${selectedChapters.length} chapters...`,
          });
          setOpen(false);
          router.refresh();
        } else {
          const errorMessage =
            result?.serverError ||
            result?.validationErrors?.toString() ||
            "Failed to start generation";
          toast.error("Generation failed", {
            description: errorMessage,
          });
        }
      } catch (error) {
        toast.error("Generation failed", {
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    });
  };

  // 确保有大纲数据
  if (!task.documentOutline) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Chapters</DialogTitle>
          <DialogDescription>
            Choose which chapters to generate flashcards from. You can select
            all or pick specific sections.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <OutlineSelector
            outline={task.documentOutline}
            filename={task.sourceFilename}
            onGenerate={handleGenerate}
            isGenerating={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
